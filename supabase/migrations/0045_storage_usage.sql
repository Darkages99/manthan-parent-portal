-- Lets the school see roughly how much storage the app is using, so they know
-- when it's time to back up and reset. Two components: the Postgres database
-- itself, and Firebase Storage (where report cards/attachments/receipts
-- actually live — see src/lib/firebase/storage.ts). Computed on demand by a
-- principal and cached as a snapshot rather than recomputed on every
-- dashboard load, since listing every Storage object isn't free.
create function database_size_bytes()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

revoke all on function database_size_bytes() from public;
grant execute on function database_size_bytes() to authenticated;

create table storage_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  db_bytes bigint not null,
  file_bytes bigint not null,
  computed_at timestamptz not null default now(),
  computed_by uuid references staff (id)
);

alter table storage_usage_snapshots enable row level security;

create policy "principal-tier reads storage snapshots" on storage_usage_snapshots for select
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

create policy "principal-tier records storage snapshots" on storage_usage_snapshots for insert
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
