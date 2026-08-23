-- Default-submitted design: a row's mere existence means "marked not
-- submitted" — no row is inserted for the (common) submitted case, so a
-- homework assignment for a full class doesn't need one row per student.
create table homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references homework_assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (homework_id, student_id)
);
create index homework_submissions_homework_idx on homework_submissions (homework_id);

alter table homework_submissions enable row level security;

create policy "staff manage homework submissions" on homework_submissions for all
  using (is_staff())
  with check (is_staff());
