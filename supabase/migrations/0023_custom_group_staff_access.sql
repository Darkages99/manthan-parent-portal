-- Lets a principal/super_admin/coordinator "assign" a teacher to a custom
-- group they didn't create themselves, so that teacher can message it despite
-- being otherwise scoped to their own taught classes/students. See
-- src/lib/roles.ts PRINCIPAL_ROLES for who counts as admin-equivalent here.

create table custom_group_staff_access (
  custom_group_id uuid not null references custom_groups (id) on delete cascade,
  staff_id uuid not null references staff (id) on delete cascade,
  granted_by uuid not null references staff (id),
  created_at timestamptz not null default now(),
  primary key (custom_group_id, staff_id)
);

alter table custom_group_staff_access enable row level security;

drop policy if exists "staff reads own group access" on custom_group_staff_access;
create policy "staff reads own group access" on custom_group_staff_access for select
  using (is_staff());

drop policy if exists "principal manages group access" on custom_group_staff_access;
create policy "principal manages group access" on custom_group_staff_access for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
