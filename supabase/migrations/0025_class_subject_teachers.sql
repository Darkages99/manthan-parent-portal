-- Source of truth for "who teaches what in which class," independent of the
-- timetable grid. Feeds the new Classes detail page (subject/teacher manager,
-- drag-and-drop) and the timetable teacher picker (suggests an assigned
-- teacher first). Dragging a teacher onto another class inserts a new row
-- here rather than moving the existing one, so the teacher keeps their
-- original assignment.
create table class_subject_teachers (
  id uuid primary key default gen_random_uuid(),
  class_section_id uuid not null references class_sections (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  teacher_id uuid not null references staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_section_id, subject_id, teacher_id)
);

create index class_subject_teachers_class_idx on class_subject_teachers (class_section_id);
create index class_subject_teachers_teacher_idx on class_subject_teachers (teacher_id);

alter table class_subject_teachers enable row level security;

drop policy if exists "staff reads class subject teachers" on class_subject_teachers;
create policy "staff reads class subject teachers" on class_subject_teachers for select
  using (is_staff());

drop policy if exists "principal manages class subject teachers" on class_subject_teachers;
create policy "principal manages class subject teachers" on class_subject_teachers for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
