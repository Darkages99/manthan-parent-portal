-- Per-category push notification opt-out. Mirrors push_subscriptions' owner
-- pattern (guardian_id XOR staff_id). Absence of a row means enabled (default
-- on); sendPush checks this before fanning out to a target.
create type notification_category as enum ('stay_back', 'leave', 'ptm', 'messages', 'reminders', 'defaulters');

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid references guardians (id) on delete cascade,
  staff_id uuid references staff (id) on delete cascade,
  category notification_category not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (num_nonnulls(guardian_id, staff_id) = 1)
);

create unique index notification_preferences_guardian_category_idx
  on notification_preferences (guardian_id, category) where guardian_id is not null;
create unique index notification_preferences_staff_category_idx
  on notification_preferences (staff_id, category) where staff_id is not null;

alter table notification_preferences enable row level security;

drop policy if exists "owner manages notification preferences" on notification_preferences;
create policy "owner manages notification preferences" on notification_preferences for all
  using (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  )
  with check (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  );
