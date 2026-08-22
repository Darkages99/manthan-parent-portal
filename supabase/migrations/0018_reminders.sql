-- Parent/staff-set reminders, optionally linked to another subject (a
-- stay-back request, PTM slot, DTR event, etc. via a loose subject_type/id
-- pair, not FK-enforced since the set of linkable subjects will grow).
-- Dispatched by the cron route (src/app/api/cron/tick) via sendPush.
create table reminders (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid references guardians (id) on delete cascade,
  staff_id uuid references staff (id) on delete cascade,
  subject_type text,
  subject_id uuid,
  remind_at timestamptz not null,
  message text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(guardian_id, staff_id) = 1)
);

create index reminders_due_idx on reminders (remind_at) where sent_at is null;

alter table reminders enable row level security;
drop policy if exists "owner manages reminders" on reminders;
create policy "owner manages reminders" on reminders for all
  using (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  )
  with check (
    (guardian_id is not null and guardian_id = current_guardian_id())
    or (staff_id is not null and staff_id = current_staff_id())
  );
