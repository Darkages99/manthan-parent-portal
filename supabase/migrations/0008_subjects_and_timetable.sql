-- Manthan Parent Portal — subjects + weekly timetable
-- Adds a shared subjects reference list, a principal-configurable set of daily
-- period slots (uniform across Mon–Sat), and per-class timetable cells. Reads
-- follow the established idiom (guardians see their children's classes via
-- current_guardian_id(); staff via is_staff()); writes are restricted to the
-- principal / super_admin using current_staff_role().

-- current_staff_role() is referenced by the generated types but was never
-- committed as a migration; (re)create it here so a fresh `db push` has it and
-- the write policies below resolve. Returns the signed-in staff member's role.
create or replace function public.current_staff_role()
  returns role language sql stable security definer set search_path to 'public'
as $function$
  select role from staff where auth_user_id = auth.uid()
$function$;

-- ---------------------------------------------------------------------------
-- Subjects — a small managed list, reused by the timetable and results entry.
-- ---------------------------------------------------------------------------
create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into subjects (name) values
  ('Maths'), ('English'), ('Science'), ('Social Studies'),
  ('Hindi'), ('Second Language'), ('Computer'),
  ('Physical Education'), ('Art')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Timetable periods — the daily slot structure (same for every day and class).
-- Break/lunch rows carry is_break = true and hold no subject/teacher.
-- ---------------------------------------------------------------------------
create table timetable_periods (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  label text not null,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  unique (position)
);

-- Default 8:30–4:00 structure; the principal can edit these later.
insert into timetable_periods (position, label, start_time, end_time, is_break) values
  (1, 'Period 1', '08:30', '09:15', false),
  (2, 'Period 2', '09:15', '10:00', false),
  (3, 'Period 3', '10:00', '10:45', false),
  (4, 'Break',    '10:45', '11:00', true),
  (5, 'Period 4', '11:00', '11:45', false),
  (6, 'Period 5', '11:45', '12:30', false),
  (7, 'Lunch',    '12:30', '13:15', true),
  (8, 'Period 6', '13:15', '14:00', false),
  (9, 'Period 7', '14:00', '14:45', false),
  (10, 'Period 8', '14:45', '15:15', false),
  (11, 'Period 9', '15:15', '16:00', false);

-- ---------------------------------------------------------------------------
-- Timetable entries — one cell per (class, day, period). day_of_week 1=Mon..6=Sat.
-- subject/teacher are nullable so a cell can be a free/unassigned slot.
-- ---------------------------------------------------------------------------
create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  class_section_id uuid not null references class_sections (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 6),
  period_id uuid not null references timetable_periods (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  teacher_id uuid references staff (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (class_section_id, day_of_week, period_id)
);

create index timetable_entries_teacher_idx on timetable_entries (teacher_id, day_of_week, period_id);
create index timetable_entries_class_idx on timetable_entries (class_section_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table subjects enable row level security;
alter table timetable_periods enable row level security;
alter table timetable_entries enable row level security;

-- Subjects: any authenticated user reads; principal/super_admin manage.
drop policy if exists "anyone reads subjects" on subjects;
create policy "anyone reads subjects" on subjects for select
  using (auth.uid() is not null);
drop policy if exists "principal manages subjects" on subjects;
create policy "principal manages subjects" on subjects for all
  using (current_staff_role() in ('principal', 'super_admin'))
  with check (current_staff_role() in ('principal', 'super_admin'));

-- Periods: any authenticated user reads; principal/super_admin manage.
drop policy if exists "anyone reads periods" on timetable_periods;
create policy "anyone reads periods" on timetable_periods for select
  using (auth.uid() is not null);
drop policy if exists "principal manages periods" on timetable_periods;
create policy "principal manages periods" on timetable_periods for all
  using (current_staff_role() in ('principal', 'super_admin'))
  with check (current_staff_role() in ('principal', 'super_admin'));

-- Entries: staff read all; guardians read their children's classes; principal writes.
drop policy if exists "staff reads all timetable entries" on timetable_entries;
create policy "staff reads all timetable entries" on timetable_entries for select
  using (is_staff());
drop policy if exists "guardian reads class timetable entries" on timetable_entries;
create policy "guardian reads class timetable entries" on timetable_entries for select
  using (
    class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
  );
drop policy if exists "principal manages timetable entries" on timetable_entries;
create policy "principal manages timetable entries" on timetable_entries for all
  using (current_staff_role() in ('principal', 'super_admin'))
  with check (current_staff_role() in ('principal', 'super_admin'));

-- Note: class-teacher assignment writes to class_sections, which already has a
-- "staff writes class sections" FOR ALL policy (migration 0001). The principal
-- restriction is enforced at the app layer (see console/classes/actions.ts).
