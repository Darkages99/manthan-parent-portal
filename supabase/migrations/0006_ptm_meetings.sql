-- ---------------------------------------------------------------------------
-- PTM meetings — promote a "parent–teacher meeting" to a first-class entity.
-- Previously a PTM only existed implicitly as a bag of ptm_slots sharing a
-- class + date. The console now creates a meeting explicitly (a card), then
-- opens/closes booking slots inside it. Slots hang off a meeting via meeting_id.
-- Additive + backfilled: existing slots are grouped into meetings so current
-- bookings keep working, and the parent booking flow (slot-based) is unaffected.
-- ---------------------------------------------------------------------------

create type ptm_status as enum ('open', 'closed');

create table ptm_meetings (
  id uuid primary key default gen_random_uuid(),
  class_section_id uuid not null references class_sections (id) on delete cascade,
  teacher_id uuid not null references staff (id),
  title text,
  meeting_date date not null,
  status ptm_status not null default 'open',
  created_at timestamptz not null default now()
);

alter table ptm_slots
  add column meeting_id uuid references ptm_meetings (id) on delete cascade;

-- Backfill: one meeting per existing (class, teacher, IST date) group, then
-- link each slot to its meeting.
with grouped as (
  select class_section_id,
         teacher_id,
         (starts_at at time zone 'Asia/Kolkata')::date as meeting_date
  from ptm_slots
  group by 1, 2, 3
),
inserted as (
  insert into ptm_meetings (class_section_id, teacher_id, meeting_date, title)
  select class_section_id, teacher_id, meeting_date, 'Parent–teacher meeting'
  from grouped
  returning id, class_section_id, teacher_id, meeting_date
)
update ptm_slots s
set meeting_id = i.id
from inserted i
where s.class_section_id = i.class_section_id
  and s.teacher_id = i.teacher_id
  and (s.starts_at at time zone 'Asia/Kolkata')::date = i.meeting_date;

-- Every slot now belongs to a meeting; new slots always will.
alter table ptm_slots alter column meeting_id set not null;

create index ptm_slots_meeting_id_idx on ptm_slots (meeting_id);
create index ptm_meetings_class_section_id_idx on ptm_meetings (class_section_id);

-- Row-level security — mirror ptm_slots: staff manage everything; guardians can
-- read meetings for their own children's classes (so the parent view can label
-- and group slots by meeting).
alter table ptm_meetings enable row level security;

drop policy if exists "guardian reads class ptm meetings" on ptm_meetings;
create policy "guardian reads class ptm meetings" on ptm_meetings for select
  using (
    class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
  );

drop policy if exists "staff full access to ptm meetings" on ptm_meetings;
create policy "staff full access to ptm meetings" on ptm_meetings for all
  using (is_staff()) with check (is_staff());
