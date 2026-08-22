-- Google Sheets roster/academic-config sync bookkeeping. The sync job itself
-- runs under the service-role (admin) client as trusted background work; RLS
-- here governs the in-app console pages that display run history / review
-- pending deletions.
create table sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  error_summary text
);

-- A row missing from the sheet is never auto-deleted from Postgres; it lands
-- here for a super_admin to review and confirm (or the next sync re-adds it
-- if the row reappears in the sheet before anyone confirms).
create table sheet_sync_pending_deletions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  sheet_row_snapshot jsonb not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references staff (id)
);

alter table sheet_sync_runs enable row level security;
drop policy if exists "staff full access to sync runs" on sheet_sync_runs;
create policy "staff full access to sync runs" on sheet_sync_runs for all
  using (is_staff()) with check (is_staff());

alter table sheet_sync_pending_deletions enable row level security;
drop policy if exists "staff full access to pending deletions" on sheet_sync_pending_deletions;
create policy "staff full access to pending deletions" on sheet_sync_pending_deletions for all
  using (is_staff()) with check (is_staff());
