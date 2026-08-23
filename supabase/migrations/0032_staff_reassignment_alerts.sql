create table staff_reassignment_alerts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index staff_reassignment_alerts_resolved_idx on staff_reassignment_alerts (resolved);

alter table staff_reassignment_alerts enable row level security;

create policy "principal manages staff alerts" on staff_reassignment_alerts for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
