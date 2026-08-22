-- "Report an issue" — in-app only, no outbound email. Confidential reports
-- are only visible to the principal/super_admin (is_principal(), migration
-- 0003); non-confidential reports are visible to all staff for triage.
create type issue_status as enum ('open', 'resolved');

create table reported_issues (
  id uuid primary key default gen_random_uuid(),
  reported_by_guardian_id uuid references guardians (id),
  reported_by_staff_id uuid references staff (id),
  subject text not null,
  body text not null,
  confidential boolean not null default false,
  status issue_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references staff (id),
  check (num_nonnulls(reported_by_guardian_id, reported_by_staff_id) = 1)
);

alter table reported_issues enable row level security;

drop policy if exists "reporter reads own issues" on reported_issues;
create policy "reporter reads own issues" on reported_issues for select
  using (
    (reported_by_guardian_id is not null and reported_by_guardian_id = current_guardian_id())
    or (reported_by_staff_id is not null and reported_by_staff_id = current_staff_id())
  );

drop policy if exists "staff reads non-confidential issues" on reported_issues;
create policy "staff reads non-confidential issues" on reported_issues for select
  using (is_staff() and not confidential);

drop policy if exists "principal reads confidential issues" on reported_issues;
create policy "principal reads confidential issues" on reported_issues for select
  using (is_principal());

drop policy if exists "guardian raises own issue" on reported_issues;
create policy "guardian raises own issue" on reported_issues for insert
  with check (reported_by_guardian_id = current_guardian_id());

drop policy if exists "staff raises own issue" on reported_issues;
create policy "staff raises own issue" on reported_issues for insert
  with check (reported_by_staff_id = current_staff_id());

drop policy if exists "staff updates issues" on reported_issues;
create policy "staff updates issues" on reported_issues for update
  using (is_staff() and (not confidential or is_principal()))
  with check (is_staff());
