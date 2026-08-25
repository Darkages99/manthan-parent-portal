-- homework_submissions rows are now an override relative to
-- homework_assignments.checked (see migration 0036), so a row's presence no
-- longer unconditionally means "not done" — notified_at on that table can no
-- longer double as a dedup marker for the "not done" push notification.
-- This is a separate ledger purely for that dedup, independent of status.
create table homework_notifications (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references homework_assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  notified_at timestamptz not null default now(),
  unique (homework_id, student_id)
);
create index homework_notifications_homework_idx on homework_notifications (homework_id);

alter table homework_notifications enable row level security;

create policy "staff manage homework notifications" on homework_notifications for all
  using (is_staff())
  with check (is_staff());

alter table homework_submissions drop column notified_at;
