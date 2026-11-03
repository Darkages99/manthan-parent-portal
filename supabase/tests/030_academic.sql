-- Academic tables (TODO 2B.2): attendance_records, exam_results, subject_grading_config,
-- grade_boundaries, defaulter_records. Fixture world: see 000_harness.sql. seed.sql
-- gives c…001 (8-B) and c…002 (5-A, both guardian_a's) attendance, results and
-- defaulter rows; one row of each is added here for c…003 (8-B, guardian_b's).
--
-- Rules as they stand (live pg_policies, 2026-11-03):
--   attendance, defaulters   guardian reads own children's; any staff writes (marking
--                            is school-wide by design)
--   exam_results             guardian reads own children's; staff read all; writes need
--                            staff_can_edit_student_marks(): principal tier, or a class
--                            the teacher owns or teaches (any subject: the app narrows
--                            this to the subject); super admin everything
--   grading config, bands    staff only, any staff writes (the app narrows writes)
begin;
select plan(41);

insert into attendance_records (student_id, date, status) values
  ('c0000000-0000-0000-0000-000000000003', '2026-07-01', 'present');
insert into exam_results (id, student_id, term, subject, marks, max_marks, grade) values
  ('f3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Term 1', 'English', 70, 100, 'B');
insert into defaulter_records (student_id, incident_date, description) values
  ('c0000000-0000-0000-0000-000000000003', '2026-07-02', 'Fixture incident.');
insert into subject_grading_config (subject, term, max_marks) values ('English', 'Term 1', 100)
  on conflict (subject, term) do nothing;
insert into grade_boundaries (subject, term, grade, min_pct, max_pct) values ('English', 'Term 1', 'A', 80, 100)
  on conflict (subject, term, grade) do nothing;

create temp table totals on commit drop as select
  (select count(*) from exam_results) as results,
  (select count(*) from attendance_records where student_id in
    ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')) as att_a,
  (select count(*) from exam_results where student_id in
    ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')) as res_a,
  (select count(*) from defaulter_records where student_id in
    ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')) as def_a;
grant select on totals to anon, authenticated;

-- ---- Anonymous visitors see nothing ----
select tests.authenticate_anon();
select is(tests.visible('attendance_records'), 0::bigint, 'anon: no attendance');
select is(tests.visible('exam_results'), 0::bigint, 'anon: no results');
select is(tests.visible('defaulter_records'), 0::bigint, 'anon: no defaulter records');
select is(tests.visible('subject_grading_config'), 0::bigint, 'anon: no grading config');
select is(tests.visible('grade_boundaries'), 0::bigint, 'anon: no grade bands');
reset role;

-- ---- A signed-in account that is neither staff nor guardian ----
select tests.authenticate_as('stranger');
select is(tests.visible('attendance_records'), 0::bigint, 'stranger: no attendance');
select is(tests.visible('exam_results'), 0::bigint, 'stranger: no results');
select is(tests.visible('defaulter_records'), 0::bigint, 'stranger: no defaulter records');
reset role;

-- ---- Parents: own children only, read-only ----
select tests.authenticate_as('guardian_a');
select is(tests.visible('attendance_records'), (select att_a from totals), 'a parent sees their children''s attendance');
select is(tests.visible('exam_results'), (select res_a from totals), 'a parent sees their children''s results');
select is(tests.visible('defaulter_records'), (select def_a from totals), 'a parent sees their children''s defaulter records');
select is(tests.visible('exam_results', $$student_id = 'c0000000-0000-0000-0000-000000000003'$$), 0::bigint,
  'a parent cannot see a classmate''s results');
select is(tests.visible('attendance_records', $$student_id = 'c0000000-0000-0000-0000-000000000003'$$), 0::bigint,
  'a parent cannot see a classmate''s attendance');
select is(tests.visible('grade_boundaries'), 0::bigint, 'a parent cannot read grade bands');
select is(tests.visible('subject_grading_config'), 0::bigint, 'a parent cannot read grading config');
select throws_ok(
  $$insert into attendance_records (student_id, date, status)
    values ('c0000000-0000-0000-0000-000000000001', '2026-09-01', 'present')$$,
  '42501', null, 'a parent cannot mark attendance');
select is(tests.affected($$update exam_results set marks = 100 where student_id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a parent cannot change their child''s marks');
select is(tests.affected($$delete from defaulter_records where student_id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a parent cannot delete their child''s defaulter records');
select throws_ok(
  $$insert into exam_results (student_id, term, subject, marks, max_marks)
    values ('c0000000-0000-0000-0000-000000000001', 'Term 3', 'English', 100, 100)$$,
  '42501', null, 'a parent cannot add results');
select tests.authenticate_as('guardian_b');
select is(tests.visible('exam_results'), 1::bigint, 'the other parent sees only their child''s result');
select is(tests.visible('attendance_records'), 1::bigint, 'the other parent sees only their child''s attendance');
select is(tests.visible('defaulter_records'), 1::bigint, 'the other parent sees only their child''s defaulter record');
reset role;

-- ---- Class teacher of 8-B: marks for 8-B only; attendance and defaulters school-wide ----
select tests.authenticate_as('teacher_8b');
select is(tests.visible('exam_results'), (select results from totals), 'a teacher reads all results');
select is(tests.affected($$update exam_results set marks = 79 where student_id = 'c0000000-0000-0000-0000-000000000001'
  and term = 'Term 1' and subject = 'English'$$), 1::bigint, 'a teacher edits marks in their own class');
select is(tests.affected($$update exam_results set marks = 0 where student_id = 'c0000000-0000-0000-0000-000000000002'$$),
  0::bigint, 'a teacher cannot edit marks in another class');
select throws_ok(
  $$insert into exam_results (student_id, term, subject, marks, max_marks)
    values ('c0000000-0000-0000-0000-000000000002', 'Term 3', 'English', 50, 100)$$,
  '42501', null, 'a teacher cannot add marks in another class');
select lives_ok(
  $$insert into exam_results (student_id, term, subject, marks, max_marks)
    values ('c0000000-0000-0000-0000-000000000003', 'Term 1', 'Hindi', 60, 100)$$,
  'a teacher adds marks in their own class');
select is(tests.affected($$delete from exam_results where student_id = 'c0000000-0000-0000-0000-000000000002'$$),
  0::bigint, 'a teacher cannot delete marks in another class');
select lives_ok(
  $$insert into attendance_records (student_id, date, status)
    values ('c0000000-0000-0000-0000-000000000002', '2026-09-01', 'present')$$,
  'any staff marks attendance in any class (school-wide by design)');
select lives_ok(
  $$insert into defaulter_records (student_id, incident_date, description)
    values ('c0000000-0000-0000-0000-000000000002', '2026-09-01', 'Logged by another class''s teacher.')$$,
  'any staff records a defaulter in any class');
select is(tests.affected($$update subject_grading_config set max_marks = 80 where subject = 'English' and term = 'Term 1'$$),
  1::bigint, 'any staff can change grading config at the RLS layer (the app narrows it)');
reset role;

select tests.authenticate_as('teacher_5a');
select is(tests.affected($$update exam_results set marks = 0 where student_id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'the 5-A teacher cannot edit 8-B marks');
select is(tests.affected($$update exam_results set marks = 89 where student_id = 'c0000000-0000-0000-0000-000000000002'
  and term = 'Term 1' and subject = 'English'$$), 1::bigint, 'the 5-A teacher edits 5-A marks');
reset role;

-- ---- Front office: reads results, cannot write marks (report cards go through the
-- service role after assertCanManageReportCard); marks attendance ----
select tests.authenticate_as('front_office');
select is(tests.visible('exam_results'), (select results from totals) + 1, 'front office reads all results');
select is(tests.affected($$update exam_results set report_card_pdf_url = null where student_id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'front office cannot write exam results directly');
select throws_ok(
  $$insert into exam_results (student_id, term, subject, marks, max_marks)
    values ('c0000000-0000-0000-0000-000000000001', 'Term 3', 'English', 50, 100)$$,
  '42501', null, 'front office cannot add marks');
select is(tests.affected($$update attendance_records set status = 'late' where student_id = 'c0000000-0000-0000-0000-000000000003'
  and date = '2026-07-01'$$), 1::bigint, 'front office corrects attendance');
reset role;

-- ---- Principal tier and super admin: all marks ----
select tests.authenticate_as('coordinator');
select is(tests.affected($$update exam_results set grade = 'B+' where id = 'f3000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'coordinator edits any class''s marks');
select tests.authenticate_as('principal');
select lives_ok(
  $$insert into exam_results (student_id, term, subject, marks, max_marks)
    values ('c0000000-0000-0000-0000-000000000002', 'Term 3', 'English', 75, 100)$$,
  'principal adds marks in any class');
select is(tests.affected($$delete from grade_boundaries where subject = 'English' and term = 'Term 1' and grade = 'A'$$),
  1::bigint, 'principal removes a grade band');
select tests.authenticate_as('super_admin');
select is(tests.affected($$delete from exam_results where id = 'f3000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'super admin deletes a result');
reset role;

select * from finish();
rollback;
