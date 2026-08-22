-- Homework & Assignments tracker (phase 2 item, staff-authored / parent-read).
create table homework_assignments (
  id uuid primary key default gen_random_uuid(),
  class_section_id uuid not null references class_sections (id) on delete cascade,
  subject_id uuid references subjects (id),
  teacher_id uuid references staff (id),
  title text not null,
  description text,
  due_date date not null,
  created_at timestamptz not null default now()
);

create index homework_assignments_class_idx on homework_assignments (class_section_id, due_date);

alter table homework_assignments enable row level security;

drop policy if exists "guardian reads class homework" on homework_assignments;
create policy "guardian reads class homework" on homework_assignments for select
  using (
    class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
  );
drop policy if exists "staff full access to homework" on homework_assignments;
create policy "staff full access to homework" on homework_assignments for all
  using (is_staff()) with check (is_staff());
