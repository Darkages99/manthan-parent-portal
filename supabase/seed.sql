-- Manthan Parent Portal — placeholder seed data for the module demo.
-- Re-runnable (delete-then-insert). Assumes the base seed already exists:
--   Guardian Sarang d...001; students Arjun c...001 (8-B / teacher Anjali b...001)
--   and Meera c...002 (5-A / teacher Suresh b...002); principal Kavita b...003.
-- Names, marks and incidents here are illustrative placeholders only.

-- ---- Attendance: weekdays 2026-07-01..2026-07-29 ----
delete from attendance_records where student_id in
  ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002');
insert into attendance_records (student_id, date, status, marked_by)
select s.sid, g.d::date,
  case
    when s.sid = 'c0000000-0000-0000-0000-000000000001' and g.d::date in ('2026-07-08','2026-07-21') then 'absent'
    when s.sid = 'c0000000-0000-0000-0000-000000000001' and g.d::date = '2026-07-15' then 'late'
    when s.sid = 'c0000000-0000-0000-0000-000000000002' and g.d::date = '2026-07-10' then 'half_day'
    when s.sid = 'c0000000-0000-0000-0000-000000000002' and g.d::date = '2026-07-23' then 'absent'
    when s.sid = 'c0000000-0000-0000-0000-000000000002' and g.d::date = '2026-07-03' then 'late'
    else 'present'
  end::attendance_status,
  s.tid
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid,'b0000000-0000-0000-0000-000000000001'::uuid),
  ('c0000000-0000-0000-0000-000000000002'::uuid,'b0000000-0000-0000-0000-000000000002'::uuid)
) as s(sid,tid)
cross join generate_series('2026-07-01'::date,'2026-07-29'::date,'1 day') g(d)
where extract(isodow from g.d) < 6;

-- ---- Exam results: Term 1 + Term 2 ----
delete from exam_results where student_id in
  ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002');
insert into exam_results (student_id, term, subject, marks, max_marks, grade) values
  ('c0000000-0000-0000-0000-000000000001','Term 1','English',78,100,'B+'),
  ('c0000000-0000-0000-0000-000000000001','Term 1','Mathematics',91,100,'A+'),
  ('c0000000-0000-0000-0000-000000000001','Term 1','Science',85,100,'A'),
  ('c0000000-0000-0000-0000-000000000001','Term 1','Social Studies',72,100,'B'),
  ('c0000000-0000-0000-0000-000000000001','Term 1','Hindi',80,100,'A'),
  ('c0000000-0000-0000-0000-000000000001','Term 1','Computer Science',88,100,'A'),
  ('c0000000-0000-0000-0000-000000000001','Term 2','English',82,100,'A'),
  ('c0000000-0000-0000-0000-000000000001','Term 2','Mathematics',94,100,'A+'),
  ('c0000000-0000-0000-0000-000000000001','Term 2','Science',79,100,'B+'),
  ('c0000000-0000-0000-0000-000000000001','Term 2','Social Studies',77,100,'B+'),
  ('c0000000-0000-0000-0000-000000000001','Term 2','Hindi',83,100,'A'),
  ('c0000000-0000-0000-0000-000000000001','Term 2','Computer Science',90,100,'A+'),
  ('c0000000-0000-0000-0000-000000000002','Term 1','English',88,100,'A'),
  ('c0000000-0000-0000-0000-000000000002','Term 1','Mathematics',76,100,'B+'),
  ('c0000000-0000-0000-0000-000000000002','Term 1','EVS',92,100,'A+'),
  ('c0000000-0000-0000-0000-000000000002','Term 1','Hindi',84,100,'A'),
  ('c0000000-0000-0000-0000-000000000002','Term 1','Computer',90,100,'A+'),
  ('c0000000-0000-0000-0000-000000000002','Term 1','Art & Craft',95,100,'A+'),
  ('c0000000-0000-0000-0000-000000000002','Term 2','English',90,100,'A+'),
  ('c0000000-0000-0000-0000-000000000002','Term 2','Mathematics',81,100,'A'),
  ('c0000000-0000-0000-0000-000000000002','Term 2','EVS',89,100,'A'),
  ('c0000000-0000-0000-0000-000000000002','Term 2','Hindi',86,100,'A'),
  ('c0000000-0000-0000-0000-000000000002','Term 2','Computer',93,100,'A+'),
  ('c0000000-0000-0000-0000-000000000002','Term 2','Art & Craft',97,100,'A+');

-- ---- Defaulter records ----
delete from defaulter_records where student_id in
  ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002');
insert into defaulter_records (student_id, incident_date, description, action_taken, recorded_by) values
  ('c0000000-0000-0000-0000-000000000001','2026-07-09','Reported late to morning assembly.','Counselled; asked to arrive by 7:50 AM.','b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001','2026-07-16','Mathematics homework not submitted.','Verbal warning; required to complete by next class.','b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002','2026-07-22','Talking during the Hindi period.','Seat reassigned for the week.','b0000000-0000-0000-0000-000000000002');

-- ---- PTM slots: 2026-08-08, 09:00-11:00 IST, 15-min slots, per class teacher ----
delete from ptm_slots where class_section_id in
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002');
insert into ptm_slots (teacher_id, class_section_id, starts_at, ends_at)
select t.tid, t.cid,
  ('2026-08-08 '::text || to_char(slot, 'HH24:MI') || ':00+05:30')::timestamptz,
  ('2026-08-08 '::text || to_char(slot + interval '15 min', 'HH24:MI') || ':00+05:30')::timestamptz
from (values
  ('b0000000-0000-0000-0000-000000000001'::uuid,'a0000000-0000-0000-0000-000000000001'::uuid),
  ('b0000000-0000-0000-0000-000000000002'::uuid,'a0000000-0000-0000-0000-000000000002'::uuid)
) as t(tid,cid)
cross join generate_series(timestamp '2026-08-08 09:00', timestamp '2026-08-08 10:45', interval '15 min') slot;

update ptm_slots set booked_by_guardian_id='d0000000-0000-0000-0000-000000000001',
  booked_student_id='c0000000-0000-0000-0000-000000000001'
where class_section_id='a0000000-0000-0000-0000-000000000001'
  and starts_at = '2026-08-08 09:30:00+05:30';

-- ---- Custom group (message targeting demo) ----
delete from custom_groups where name='Grade 8 Basketball Team';
with g as (
  insert into custom_groups (name, created_by)
  values ('Grade 8 Basketball Team','b0000000-0000-0000-0000-000000000001')
  returning id
)
insert into custom_group_students (custom_group_id, student_id)
select g.id, 'c0000000-0000-0000-0000-000000000001' from g;
