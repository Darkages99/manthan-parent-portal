-- Per-student teacher remark on a homework assignment (e.g. "very well
-- done"), independent of homework_submissions so it survives done/not-done
-- toggling and the "Mark all as checked" reset (see 0036).
create table homework_comments (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references homework_assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (homework_id, student_id)
);
create index homework_comments_homework_idx on homework_comments (homework_id);

alter table homework_comments enable row level security;

create policy "staff manage homework comments" on homework_comments for all
  using (is_staff()) with check (is_staff());

create policy "guardian reads own children's homework comments" on homework_comments for select
  using (
    student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())
  );
