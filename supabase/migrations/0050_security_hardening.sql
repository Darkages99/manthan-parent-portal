-- Security audit remediation — see SECURITY_AUDIT.md (findings F1–F13).
-- Applied 2026-09-03.

-------------------------------------------------------------------------------
-- F1  Staff-directory PII exposure.
-- Every authenticated user (incl. all parents) could read the whole `staff`
-- table: phone, email and — worst — the login `username`. Restrict the base
-- table to staff, and expose a name/role-only view for the guardian pickers
-- (report-issue / stay-back / ptm / timetable) that legitimately list teachers.
-------------------------------------------------------------------------------
drop policy if exists "authenticated reads staff" on staff;
drop policy if exists "authenticated read staff directory" on staff;

create policy "staff reads all staff" on staff
  for select using (is_staff());

create or replace view public.staff_directory
  with (security_invoker = false) as
  select id, name, role, active from public.staff;

revoke all on public.staff_directory from anon, public;
grant select on public.staff_directory to authenticated;

-------------------------------------------------------------------------------
-- F2  Privilege escalation to super_admin.
-- "principal manages staff" let a coordinator/principal create or elevate a
-- super_admin, defeating the stricter requireSuperAdmin() gate. Split it so
-- only a super_admin may touch super_admin rows or grant the super_admin role.
-------------------------------------------------------------------------------
drop policy if exists "principal manages staff" on staff;

create policy "super_admin manages all staff" on staff
  for all
  using (current_staff_role() = 'super_admin'::role)
  with check (current_staff_role() = 'super_admin'::role);

create policy "principal manages non-superadmin staff" on staff
  for all
  using (
    current_staff_role() = any (array['principal','coordinator']::role[])
    and role <> 'super_admin'::role
  )
  with check (
    current_staff_role() = any (array['principal','coordinator']::role[])
    and role <> 'super_admin'::role
  );

-------------------------------------------------------------------------------
-- F3  Teacher write-scope for marks enforced only in app code.
-- RLS `ALL USING is_staff()` let any staff write any student's exam_results.
-- Scope writes to principal-tier or the teacher of the student's class (mirrors
-- lib/results-scope + lib/teacher-scope). Reads stay staff-wide (unchanged).
-- (Attendance intentionally stays all-staff — the front office marks it
-- school-wide; saveAttendance has no class gate by design.)
-------------------------------------------------------------------------------
create or replace function public.staff_can_edit_student_marks(p_student uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    current_staff_role() = any (array['principal','super_admin','coordinator']::role[])
    or exists (
      select 1 from students s
      where s.id = p_student
        and s.class_section_id in (
          select cs.id from class_sections cs where cs.class_teacher_id = current_staff_id()
          union
          select te.class_section_id from timetable_entries te where te.teacher_id = current_staff_id()
          union
          select cst.class_section_id from class_subject_teachers cst where cst.teacher_id = current_staff_id()
        )
    );
$$;
revoke execute on function public.staff_can_edit_student_marks(uuid) from anon, public;
grant execute on function public.staff_can_edit_student_marks(uuid) to authenticated;

drop policy if exists "staff full access to results" on exam_results;

create policy "staff reads all results" on exam_results
  for select using (is_staff());
create policy "staff writes results in scope" on exam_results
  for insert with check (staff_can_edit_student_marks(student_id));
create policy "staff updates results in scope" on exam_results
  for update using (staff_can_edit_student_marks(student_id))
  with check (staff_can_edit_student_marks(student_id));
create policy "staff deletes results in scope" on exam_results
  for delete using (staff_can_edit_student_marks(student_id));

-------------------------------------------------------------------------------
-- F4  push_subscriptions had RLS enabled but zero policies (deny-all), while
-- the app relied on RLS to scope rows to their owner. Add the owner policy.
-------------------------------------------------------------------------------
drop policy if exists "owner manages own push subscriptions" on push_subscriptions;
create policy "owner manages own push subscriptions" on push_subscriptions
  for all
  using (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  )
  with check (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  );

-------------------------------------------------------------------------------
-- F12  Revoke RPC EXECUTE from anon on helper/definer functions. These are
-- only ever called by authenticated staff (or internally by policies, which
-- run with definer rights regardless of grants), so anon never needs them.
-------------------------------------------------------------------------------
revoke execute on function public.database_size_bytes() from anon;
revoke execute on function public.current_staff_role() from anon;
revoke execute on function public.current_staff_id() from anon;
revoke execute on function public.current_guardian_id() from anon;
revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_principal() from anon;
revoke execute on function public.current_staff_is_issue_recipient(uuid) from anon;
revoke execute on function public.enforce_guardian_valid() from anon;
revoke execute on function public.enforce_link_valid() from anon;

-------------------------------------------------------------------------------
-- F13  Pin search_path on the remaining SECURITY INVOKER helper functions.
-------------------------------------------------------------------------------
alter function public.attendance_summary(uuid[]) set search_path to 'public';
alter function public.create_student_with_guardians(text, text, text, uuid, uuid[], text) set search_path to 'public';
alter function public.replace_guardian_children(uuid, uuid[]) set search_path to 'public';
alter function public.sync_upsert_guardian(text, text, text, uuid[], uuid, text) set search_path to 'public';
