-- Retire legacy schema (TODO 4.1, 4.2). Checked against the live database on
-- 2026-11-01 before writing: `reminders` had 0 rows, no foreign keys into it and
-- no function referencing it; no approval_steps row used 'ptm_slot_request'; no
-- staff row had role 'admin'.
--
-- Postgres cannot drop a single enum value; the type has to be rebuilt. `role`
-- is the return type of current_staff_role(), which 21 policies call, so
-- rebuilding it means dropping and recreating all of them. Instead the two
-- values stay in their enums but are unusable: every reference is removed and a
-- CHECK constraint stops them coming back. Full removal can be done once
-- migrations replay on a local database (TODO 3.1) and can be rehearsed there.

-- ---------------------------------------------------------------------------
-- 4.1 reminders (0018). The feature was removed; the table was never written.
-- The 'reminders' notification_category value is a separate matter and stays.
-- ---------------------------------------------------------------------------
drop table if exists reminders;

-- ---------------------------------------------------------------------------
-- 4.2a 'ptm_slot_request' (0010). PTM approval was removed in 0041.
-- ---------------------------------------------------------------------------
drop policy if exists "guardian reads own approval steps" on approval_steps;
create policy "guardian reads own approval steps" on approval_steps for select
  using (
    subject_type = 'stay_back_consent'
    and subject_id in (
      select id from stay_back_consents
      where student_id in (
        select student_id from guardian_student where guardian_id = current_guardian_id()
      )
    )
  );

alter table approval_steps drop constraint if exists approval_steps_subject_type_in_use;
alter table approval_steps add constraint approval_steps_subject_type_in_use
  check (subject_type = 'stay_back_consent');

-- ---------------------------------------------------------------------------
-- 4.2b 'admin' role (0030). Replaced by 'front_office'.
-- ---------------------------------------------------------------------------
delete from message_send_permissions where role = 'admin';

drop policy if exists "front office reads shared issues" on reported_issues;
create policy "front office reads shared issues" on reported_issues for select
  using (
    current_staff_role() = 'front_office'
    and audience = 'front_office_and_principal'
  );

drop policy if exists "staff resolves visible issues" on reported_issues;
create policy "staff resolves visible issues" on reported_issues for update
  using (
    current_staff_role() in ('principal', 'super_admin', 'coordinator')
    or (current_staff_role() = 'front_office' and audience = 'front_office_and_principal')
    or current_staff_is_issue_recipient(id)
  )
  with check (is_staff());

alter table staff drop constraint if exists staff_role_not_admin;
alter table staff add constraint staff_role_not_admin check (role <> 'admin');

alter table message_send_permissions drop constraint if exists message_send_permissions_role_not_admin;
alter table message_send_permissions add constraint message_send_permissions_role_not_admin
  check (role <> 'admin');
