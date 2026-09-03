-- DG-1 (compliance/09) — data retention + right-to-erasure machinery.
--
-- Two functions:
--   * prune_old_records()  — bounded retention for the append-only logs, run
--     from the daily cron. Windows are defined here; change the intervals to
--     change the policy. (Governance: the school owns these numbers.)
--   * erase_student(uuid)  — DPDP right-to-erasure. Removes a student and all
--     dependent records across every table (in FK-safe order), plus any guardian
--     left with no remaining children, and returns the Firebase file URLs and
--     guardian auth-user ids the app layer must also delete (Storage + Auth live
--     outside Postgres). Super-admin only; logs an 'ERASE' row to audit_log.

-------------------------------------------------------------------------------
-- Retention pruning. Called by the cron tick via the service-role client.
-- Retention windows (change here to change policy):
--   notification_log ............ 24 months  (proof-of-notification audit)
--   audit_log ................... 24 months  (academic-edit history)
--   sheet_sync_runs ............. 12 months  (sync bookkeeping)
--   sheet_sync_pending_deletions  12 months  (only rows already RESOLVED)
-------------------------------------------------------------------------------
create or replace function public.prune_old_records()
  returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  n_notif bigint; n_audit bigint; n_runs bigint; n_pending bigint;
begin
  delete from notification_log where sent_at < now() - interval '24 months';
  get diagnostics n_notif = row_count;

  delete from audit_log where changed_at < now() - interval '24 months';
  get diagnostics n_audit = row_count;

  delete from sheet_sync_runs
    where finished_at is not null and finished_at < now() - interval '12 months';
  get diagnostics n_runs = row_count;

  delete from sheet_sync_pending_deletions
    where resolved_at is not null and resolved_at < now() - interval '12 months';
  get diagnostics n_pending = row_count;

  return jsonb_build_object(
    'notification_log', n_notif,
    'audit_log', n_audit,
    'sheet_sync_runs', n_runs,
    'sheet_sync_pending_deletions', n_pending
  );
end $$;

-- Destructive maintenance — not for end users. The cron runs it under the
-- service-role, which is granted explicitly below.
revoke execute on function public.prune_old_records() from anon, public, authenticated;
grant execute on function public.prune_old_records() to service_role;

-------------------------------------------------------------------------------
-- Right-to-erasure for a single student.
--
-- Deletes, in FK-safe order, every record that references the student (the DB
-- has a mix of CASCADE and NO ACTION foreign keys — see the FK audit in
-- compliance/03). Approval chains (approval_steps) are keyed to their subject by
-- id, not a FK, so they are removed explicitly. Any guardian left with no
-- remaining children after the student is removed is also erased (a guardian
-- with no child is orphaned PII); deleting those guardian rows inside this same
-- transaction also satisfies the deferred "student/guardian integrity" triggers
-- from 0040, which are checked at COMMIT.
--
-- Storage objects (report-card / receipt PDFs) and Supabase Auth users live
-- outside Postgres, so their identifiers are RETURNED for the caller
-- (console/students eraseStudent action) to delete via the Firebase Admin SDK
-- and the Auth admin API.
--
-- Super-admin only. Logs an 'ERASE' audit_log row.
-------------------------------------------------------------------------------
create or replace function public.erase_student(p_student uuid)
  returns jsonb language plpgsql security definer set search_path to 'public'
as $$
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

  -- Files to remove from Firebase Storage (returned to the caller).
  select array_agg(report_card_pdf_url) into v_report_urls
    from exam_results where student_id = p_student and report_card_pdf_url is not null;
  select array_agg(pay.receipt_pdf_url) into v_receipt_urls
    from payments pay
    join invoices inv on inv.id = pay.invoice_id
    where inv.student_id = p_student and pay.receipt_pdf_url is not null;

  -- Approval chains hanging off this student's stay-backs and booked PTM slots.
  select array_agg(id) into v_stayback_ids from stay_back_consents where student_id = p_student;
  select array_agg(id) into v_slot_ids from ptm_slots where booked_student_id = p_student;
  delete from approval_steps
    where (subject_type = 'stay_back_consent' and subject_id = any (coalesce(v_stayback_ids, '{}')))
       or (subject_type = 'ptm_slot_request'  and subject_id = any (coalesce(v_slot_ids, '{}')));

  -- Finance (payments reference invoices; delete children first).
  delete from payments where invoice_id in (select id from invoices where student_id = p_student);
  delete from invoices where student_id = p_student;

  -- Remaining NO ACTION student-referencing rows.
  delete from attendance_records   where student_id = p_student;
  delete from defaulter_records    where student_id = p_student;
  delete from exam_results         where student_id = p_student;
  delete from leave_requests       where student_id = p_student;
  delete from parent_consultations where student_id = p_student;
  delete from stay_back_consents   where student_id = p_student;
  delete from message_targets      where student_id = p_student;

  -- Free any PTM slot the child had booked (keep the slot, drop the booking).
  update ptm_slots set booked_student_id = null, booked_by_guardian_id = null
    where booked_student_id = p_student;

  -- Guardians currently linked to this student.
  select array_agg(guardian_id) into v_guardian_ids
    from guardian_student where student_id = p_student;

  -- Delete the student. CASCADE removes guardian_student, student_qr_codes,
  -- homework_submissions / _notifications / _comments, custom_group_students.
  delete from students where id = p_student;

  -- Erase guardians orphaned by this deletion (no remaining children).
  if v_guardian_ids is not null then
    select array_agg(g.auth_user_id) into v_orphan_auth
      from guardians g
      where g.id = any (v_guardian_ids)
        and g.auth_user_id is not null
        and not exists (select 1 from guardian_student gs where gs.guardian_id = g.id);

    -- Issues a guardian raised are not student-scoped; remove them (recipients
    -- cascade) before deleting the guardian.
    delete from reported_issues
      where reported_by_guardian_id in (
        select g.id from guardians g
        where g.id = any (v_guardian_ids)
          and not exists (select 1 from guardian_student gs where gs.guardian_id = g.id)
      );

    -- Deletes cascade message_receipts, notification_preferences,
    -- push_subscriptions, reminders.
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
end $$;

revoke execute on function public.erase_student(uuid) from anon, public;
grant execute on function public.erase_student(uuid) to authenticated; -- self-checks super_admin
