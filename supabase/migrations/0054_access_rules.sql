-- Access rules agreed with the school on 2026-11-02, and the end of the
-- file-vs-live policy drift found by the 3.2 drift check (live still carried its
-- original policy names; some behaved differently from these files).
--
-- Every table touched here has ALL its policies dropped and recreated, so the
-- result is identical whether this runs on a fresh replay or on live.
--
-- Leadership = super_admin, principal, coordinator, front_office.
--   super_admin    can do everything on every table below.
--   classes        leadership adds, edits and deletes; every signed-in user reads.
--   messages       all staff read every message and send only as themselves.
--                  A class_teacher-role sender may only target classes they teach,
--                  students in those classes, and groups they made, were given,
--                  or that hold only their own students. Only non-teachers send
--                  school-wide (message_send_permissions still gates them).
--                  Parents read a group message only when their child is in it.
--   leave          the student's class teacher, front office, coordinator and
--                  principal read and decide; any one decision closes it.
--   stay-back      chain = named teacher -> front office -> coordinator (grades
--                  1-7) or principal (grades 8+). Each approver decides only their
--                  own step (approval_steps).
--   calendar       leadership adds school-wide events. Teachers add events only
--                  through create_dtr_event(), for classes they teach or groups
--                  they can use. The creator and leadership edit or delete.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(current_staff_role() = 'super_admin', false)
$$;

create or replace function public.is_leadership()
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(current_staff_role() in ('super_admin', 'principal', 'coordinator', 'front_office'), false)
$$;

-- Mirrors getTaughtClassIds() in src/lib/teacher-scope.ts.
create or replace function public.staff_teaches_class(p_class_section_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from class_sections where id = p_class_section_id and class_teacher_id = current_staff_id())
      or exists (select 1 from timetable_entries where class_section_id = p_class_section_id and teacher_id = current_staff_id())
      or exists (select 1 from class_subject_teachers where class_section_id = p_class_section_id and teacher_id = current_staff_id())
$$;

create or replace function public.staff_teaches_student(p_student_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from students where id = p_student_id and staff_teaches_class(class_section_id))
$$;

-- Mirrors requireTeacherScope()'s group rule in console/messages/compose/actions.ts.
create or replace function public.staff_can_use_group(p_group_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from custom_groups where id = p_group_id and created_by = current_staff_id())
      or exists (select 1 from custom_group_staff_access where custom_group_id = p_group_id and staff_id = current_staff_id())
      or (
        exists (select 1 from custom_group_students where custom_group_id = p_group_id)
        and not exists (
          select 1 from custom_group_students m
          join students s on s.id = m.student_id
          where m.custom_group_id = p_group_id and not staff_teaches_class(s.class_section_id)
        )
      )
$$;

create or replace function public.is_class_teacher_of_student(p_student_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from students s
    join class_sections c on c.id = s.class_section_id
    where s.id = p_student_id and c.class_teacher_id = current_staff_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- Calendar: group targeting
-- ---------------------------------------------------------------------------
create table if not exists dtr_event_groups (
  dtr_event_id uuid not null references dtr_events (id) on delete cascade,
  custom_group_id uuid not null references custom_groups (id) on delete cascade,
  primary key (dtr_event_id, custom_group_id)
);
alter table dtr_event_groups enable row level security;

-- The only way a teacher adds an event: it inserts the event and its targets in
-- one transaction, so a teacher's event can never be left untargeted (an event
-- with no class or group rows is school-wide).
create or replace function public.create_dtr_event(
  p_title text,
  p_event_date date,
  p_category dtr_category,
  p_description text default null,
  p_class_section_ids uuid[] default '{}',
  p_group_ids uuid[] default '{}'
)
  returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_staff uuid := current_staff_id();
  v_classes uuid[] := coalesce(p_class_section_ids, '{}');
  v_groups uuid[] := coalesce(p_group_ids, '{}');
  v_id uuid;
begin
  if v_staff is null then
    raise exception 'Only staff can add calendar events' using errcode = 'insufficient_privilege';
  end if;
  if not is_leadership() then
    if cardinality(v_classes) + cardinality(v_groups) = 0 then
      raise exception 'Teachers can only add events for their own classes or groups'
        using errcode = 'insufficient_privilege';
    end if;
    if exists (select 1 from unnest(v_classes) c where not staff_teaches_class(c)) then
      raise exception 'You can only add events for classes you teach' using errcode = 'insufficient_privilege';
    end if;
    if exists (select 1 from unnest(v_groups) g where not staff_can_use_group(g)) then
      raise exception 'You can only add events for groups you have access to' using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into dtr_events (title, event_date, category, description, created_by)
  values (p_title, p_event_date, p_category, p_description, v_staff)
  returning id into v_id;

  insert into dtr_event_classes (dtr_event_id, class_section_id)
  select distinct v_id, c from unnest(v_classes) c;
  insert into dtr_event_groups (dtr_event_id, custom_group_id)
  select distinct v_id, g from unnest(v_groups) g;

  return v_id;
end $$;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_leadership() from public, anon;
revoke all on function public.staff_teaches_class(uuid) from public, anon;
revoke all on function public.staff_teaches_student(uuid) from public, anon;
revoke all on function public.staff_can_use_group(uuid) from public, anon;
revoke all on function public.is_class_teacher_of_student(uuid) from public, anon;
revoke all on function public.create_dtr_event(text, date, dtr_category, text, uuid[], uuid[]) from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.is_leadership() to authenticated, service_role;
grant execute on function public.staff_teaches_class(uuid) to authenticated, service_role;
grant execute on function public.staff_teaches_student(uuid) to authenticated, service_role;
grant execute on function public.staff_can_use_group(uuid) to authenticated, service_role;
grant execute on function public.is_class_teacher_of_student(uuid) to authenticated, service_role;
grant execute on function public.create_dtr_event(text, date, dtr_category, text, uuid[], uuid[]) to authenticated, service_role;

-- Live already blocks PUBLIC from the identity helpers; the files only revoked anon.
revoke all on function public.current_guardian_id() from public;
revoke all on function public.current_staff_id() from public;
revoke all on function public.current_staff_role() from public;
revoke all on function public.is_staff() from public;

-- ---------------------------------------------------------------------------
-- Drop every policy on the tables below, then recreate the agreed set.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'approval_steps', 'class_sections', 'custom_group_students', 'dtr_event_classes',
      'dtr_event_groups', 'dtr_events', 'guardian_student', 'guardians', 'leave_requests',
      'message_attachments', 'message_receipts', 'message_targets', 'messages',
      'push_subscriptions', 'stay_back_consents', 'students'
    )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Students, guardians and their links: unchanged behaviour, live's names.
create policy "guardian reads own students" on students for select
  using (id in (select student_id from guardian_student where guardian_id = current_guardian_id()));
create policy "staff reads all students" on students for select
  using (is_staff());
create policy "principal manages students" on students for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

create policy "guardians read own row" on guardians for select
  using (auth_user_id = auth.uid());
create policy "staff read all guardians" on guardians for select
  using (is_staff());
create policy "principal manages guardians" on guardians for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

create policy "guardian reads own links" on guardian_student for select
  using (guardian_id = current_guardian_id());
create policy "staff reads all links" on guardian_student for select
  using (is_staff());
create policy "principal manages guardian_student" on guardian_student for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

create policy "owner manages own push subscriptions" on push_subscriptions for all
  using (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  )
  with check (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  );

-- Classes.
create policy "authenticated read class sections" on class_sections for select
  using (auth.role() = 'authenticated');
create policy "leadership manages class sections" on class_sections for all
  using (is_leadership()) with check (is_leadership());

drop policy if exists "principal manages class subject teachers" on class_subject_teachers;
create policy "leadership manages class subject teachers" on class_subject_teachers for all
  using (is_leadership()) with check (is_leadership());

-- Group memberships: staff keep full access; a parent sees their own child's
-- memberships, which is what lets the message policy below find group messages.
create policy "staff full access to custom_group_students" on custom_group_students for all
  using (is_staff()) with check (is_staff());
create policy "guardian reads own group memberships" on custom_group_students for select
  using (student_id in (select student_id from guardian_student where guardian_id = current_guardian_id()));

-- Messages.
create policy "guardian reads relevant messages" on messages for select
  using (
    scope_type = 'school'::message_scope_type
    or id in (
      select mt.message_id from message_targets mt
      where (mt.class_section_id is not null and mt.class_section_id in (
              select class_section_id from students
              where id in (select student_id from guardian_student where guardian_id = current_guardian_id())))
         or (mt.student_id is not null and mt.student_id in (
              select student_id from guardian_student where guardian_id = current_guardian_id()))
         or (mt.custom_group_id is not null and mt.custom_group_id in (
              select custom_group_id from custom_group_students
              where student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())))
    )
  );
create policy "staff read all messages" on messages for select
  using (is_staff());
create policy "staff send as themselves" on messages for insert
  with check (
    is_staff()
    and sender_id = current_staff_id()
    and (scope_type <> 'school'::message_scope_type or current_staff_role() <> 'class_teacher')
  );
create policy "super admin manages messages" on messages for all
  using (is_super_admin()) with check (is_super_admin());

create policy "guardian reads own message_targets" on message_targets for select
  using (
    (class_section_id is not null and class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())))
    or (student_id is not null and student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()))
    or (custom_group_id is not null and custom_group_id in (
      select custom_group_id from custom_group_students
      where student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())))
  );
create policy "staff read message_targets" on message_targets for select
  using (is_staff());
create policy "sender targets own message in scope" on message_targets for insert
  with check (
    exists (select 1 from messages m where m.id = message_id and m.sender_id = current_staff_id())
    and (
      current_staff_role() <> 'class_teacher'
      or (
        (class_section_id is null or staff_teaches_class(class_section_id))
        and (student_id is null or staff_teaches_student(student_id))
        and (custom_group_id is null or staff_can_use_group(custom_group_id))
      )
    )
  );
create policy "super admin manages message_targets" on message_targets for all
  using (is_super_admin()) with check (is_super_admin());

create policy "guardian reads attachments of visible messages" on message_attachments for select
  using (message_id in (select id from messages));
create policy "staff full access to message_attachments" on message_attachments for all
  using (is_staff()) with check (is_staff());

create policy "guardian reads own receipts" on message_receipts for select
  using (guardian_id = current_guardian_id());
create policy "guardian updates own receipts" on message_receipts for update
  using (guardian_id = current_guardian_id())
  with check (guardian_id = current_guardian_id());
create policy "staff full access to receipts" on message_receipts for all
  using (is_staff()) with check (is_staff());

-- Leave.
create policy "guardian inserts own leave" on leave_requests for insert
  with check (
    requested_by = current_guardian_id()
    and student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())
  );
create policy "guardian reads own leave" on leave_requests for select
  using (student_id in (select student_id from guardian_student where guardian_id = current_guardian_id()));
create policy "approvers read leave" on leave_requests for select
  using (
    current_staff_role() in ('principal', 'coordinator', 'front_office')
    or is_class_teacher_of_student(student_id)
  );
create policy "approvers decide leave" on leave_requests for update
  using (
    current_staff_role() in ('principal', 'coordinator', 'front_office')
    or is_class_teacher_of_student(student_id)
  )
  with check (
    current_staff_role() in ('principal', 'coordinator', 'front_office')
    or is_class_teacher_of_student(student_id)
  );
create policy "super admin manages leave" on leave_requests for all
  using (is_super_admin()) with check (is_super_admin());

-- Stay-back. Who may decide which step is enforced on approval_steps; the
-- consent's own status is written by whichever approver closes the chain.
create policy "guardian inserts own stay-back" on stay_back_consents for insert
  with check (
    raised_by_guardian_id = current_guardian_id()
    and student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())
  );
create policy "guardian reads own stay-back" on stay_back_consents for select
  using (student_id in (select student_id from guardian_student where guardian_id = current_guardian_id()));
create policy "staff reads all stay-back" on stay_back_consents for select
  using (is_staff());
create policy "approvers decide stay-back" on stay_back_consents for update
  using (
    is_staff()
    and (teacher_id = current_staff_id() or current_staff_role() in ('front_office', 'coordinator', 'principal'))
  )
  with check (
    is_staff()
    and (teacher_id = current_staff_id() or current_staff_role() in ('front_office', 'coordinator', 'principal'))
  );
create policy "super admin manages stay-back" on stay_back_consents for all
  using (is_super_admin()) with check (is_super_admin());

create policy "guardian reads own approval steps" on approval_steps for select
  using (
    subject_type = 'stay_back_consent'::approval_subject_type
    and subject_id in (
      select id from stay_back_consents
      where student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
  );
create policy "staff read approval steps" on approval_steps for select
  using (is_staff());
-- Staff may (re)build a missing chain (ensureStayBackChains) but never pre-decide it.
create policy "staff create undecided approval steps" on approval_steps for insert
  with check (is_staff() and decision is null);
create policy "approver decides own step" on approval_steps for update
  using (
    decision is null
    and (
      approver_staff_id = current_staff_id()
      or (approver_staff_id is null and approver_role::text = current_staff_role()::text)
    )
  )
  with check (approver_staff_id = current_staff_id());
create policy "super admin manages approval steps" on approval_steps for all
  using (is_super_admin()) with check (is_super_admin());

-- Calendar.
create policy "authenticated read dtr_events" on dtr_events for select
  using (auth.role() = 'authenticated');
create policy "leadership manages dtr_events" on dtr_events for all
  using (is_leadership()) with check (is_leadership());
create policy "creator edits own dtr_events" on dtr_events for update
  using (created_by = current_staff_id()) with check (created_by = current_staff_id());
create policy "creator deletes own dtr_events" on dtr_events for delete
  using (created_by = current_staff_id());

create policy "authenticated read dtr_event_classes" on dtr_event_classes for select
  using (auth.role() = 'authenticated');
create policy "leadership manages dtr_event_classes" on dtr_event_classes for all
  using (is_leadership()) with check (is_leadership());

create policy "authenticated read dtr_event_groups" on dtr_event_groups for select
  using (auth.role() = 'authenticated');
create policy "leadership manages dtr_event_groups" on dtr_event_groups for all
  using (is_leadership()) with check (is_leadership());

-- ---------------------------------------------------------------------------
-- Super admin: full access on the remaining tables that lacked it. audit_log
-- and notification_log stay append-only, and push_subscriptions and
-- notification_preferences stay with their owner.
-- ---------------------------------------------------------------------------
drop policy if exists "super admin manages exam_results" on exam_results;
create policy "super admin manages exam_results" on exam_results for all
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists "super admin manages reported_issues" on reported_issues;
create policy "super admin manages reported_issues" on reported_issues for all
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists "super admin manages reported_issue_recipients" on reported_issue_recipients;
create policy "super admin manages reported_issue_recipients" on reported_issue_recipients for all
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists "super admin manages invoices" on invoices;
create policy "super admin manages invoices" on invoices for all
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists "super admin manages payments" on payments;
create policy "super admin manages payments" on payments for all
  using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- Stay-back chains already in flight: grades 1-7 now end with the coordinator,
-- so drop their undecided principal step and close any chain that is now done.
-- ---------------------------------------------------------------------------
delete from approval_steps st
using stay_back_consents sb
join students s on s.id = sb.student_id
join class_sections cs on cs.id = s.class_section_id
where st.subject_type = 'stay_back_consent'
  and st.subject_id = sb.id
  and sb.status = 'pending'
  and case when cs.grade ~ '^\d+$' then cs.grade::int < 8 else false end
  and st.approver_role = 'principal'
  and st.decision is null
  and exists (
    select 1 from approval_steps c
    where c.subject_type = 'stay_back_consent' and c.subject_id = sb.id and c.approver_role = 'coordinator'
  );

update stay_back_consents sb set status = 'approved'
where sb.status = 'pending'
  and exists (select 1 from approval_steps st where st.subject_type = 'stay_back_consent' and st.subject_id = sb.id)
  and not exists (
    select 1 from approval_steps st
    where st.subject_type = 'stay_back_consent' and st.subject_id = sb.id
      and st.decision is distinct from 'approved'
  );

-- ---------------------------------------------------------------------------
-- These four bodies match live except for comments, which `db diff` compares.
-- Restate them exactly as live has them so the drift check comes back empty.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into audit_log (table_name, record_id, operation, actor_staff_id, actor_auth_id, old_row, new_row)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    current_staff_id(),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_guardian_valid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from guardians where id = NEW.id) then
    return null;
  end if;
  if exists (
    select 1 from guardians g
    where g.id = NEW.id and g.email is not null and btrim(g.email) <> ''
  ) then
    return null;
  end if;
  if exists (select 1 from guardian_student where guardian_id = NEW.id) then
    return null;
  end if;
  raise exception 'A parent must have a linked child or an email address'
    using errcode = 'check_violation';
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_link_valid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_student uuid := coalesce(NEW.student_id, OLD.student_id);
  v_guardian uuid := coalesce(NEW.guardian_id, OLD.guardian_id);
begin
  if exists (select 1 from students where id = v_student)
     and not exists (select 1 from guardian_student where student_id = v_student) then
    raise exception 'A student must have at least one parent'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from guardians where id = v_guardian)
     and not exists (
       select 1 from guardians g
       where g.id = v_guardian and g.email is not null and btrim(g.email) <> ''
     )
     and not exists (select 1 from guardian_student where guardian_id = v_guardian) then
    raise exception 'A parent must have a linked child or an email address'
      using errcode = 'check_violation';
  end if;

  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.erase_student(p_student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report_urls text[];
  v_receipt_urls text[];
  v_guardian_ids uuid[];
  v_orphan_auth uuid[];
  v_stayback_ids uuid[];
  v_slot_ids uuid[];
begin
  if current_staff_role() is distinct from 'super_admin'::role then
    raise exception 'Only a super admin can erase a student'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from students where id = p_student) then
    raise exception 'Student not found';
  end if;

  select array_agg(report_card_pdf_url) into v_report_urls
    from exam_results where student_id = p_student and report_card_pdf_url is not null;
  select array_agg(pay.receipt_pdf_url) into v_receipt_urls
    from payments pay
    join invoices inv on inv.id = pay.invoice_id
    where inv.student_id = p_student and pay.receipt_pdf_url is not null;

  select array_agg(id) into v_stayback_ids from stay_back_consents where student_id = p_student;
  select array_agg(id) into v_slot_ids from ptm_slots where booked_student_id = p_student;
  delete from approval_steps
    where (subject_type = 'stay_back_consent' and subject_id = any (coalesce(v_stayback_ids, '{}')))
       or (subject_type = 'ptm_slot_request'  and subject_id = any (coalesce(v_slot_ids, '{}')));

  delete from payments where invoice_id in (select id from invoices where student_id = p_student);
  delete from invoices where student_id = p_student;

  delete from attendance_records   where student_id = p_student;
  delete from defaulter_records    where student_id = p_student;
  delete from exam_results         where student_id = p_student;
  delete from leave_requests       where student_id = p_student;
  delete from parent_consultations where student_id = p_student;
  delete from stay_back_consents   where student_id = p_student;
  delete from message_targets      where student_id = p_student;

  update ptm_slots set booked_student_id = null, booked_by_guardian_id = null
    where booked_student_id = p_student;

  select array_agg(guardian_id) into v_guardian_ids
    from guardian_student where student_id = p_student;

  delete from students where id = p_student;

  if v_guardian_ids is not null then
    select array_agg(g.auth_user_id) into v_orphan_auth
      from guardians g
      where g.id = any (v_guardian_ids)
        and g.auth_user_id is not null
        and not exists (select 1 from guardian_student gs where gs.guardian_id = g.id);

    delete from reported_issues
      where reported_by_guardian_id in (
        select g.id from guardians g
        where g.id = any (v_guardian_ids)
          and not exists (select 1 from guardian_student gs where gs.guardian_id = g.id)
      );

    delete from guardians g
      where g.id = any (v_guardian_ids)
        and not exists (select 1 from guardian_student gs where gs.guardian_id = g.id);
  end if;

  insert into audit_log (table_name, record_id, operation, actor_staff_id, actor_auth_id, new_row)
  values ('students', p_student, 'ERASE', current_staff_id(), auth.uid(),
          jsonb_build_object(
            'report_card_urls', coalesce(to_jsonb(v_report_urls), '[]'::jsonb),
            'receipt_urls', coalesce(to_jsonb(v_receipt_urls), '[]'::jsonb),
            'orphaned_guardian_auth_ids', coalesce(to_jsonb(v_orphan_auth), '[]'::jsonb)
          ));

  return jsonb_build_object(
    'report_card_urls', coalesce(to_jsonb(v_report_urls), '[]'::jsonb),
    'receipt_urls', coalesce(to_jsonb(v_receipt_urls), '[]'::jsonb),
    'orphaned_guardian_auth_ids', coalesce(to_jsonb(v_orphan_auth), '[]'::jsonb)
  );
end $function$
;
