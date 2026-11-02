-- Access rules from migration 0054, one block per area. Fixture world: see
-- 000_harness.sql. 8-B (grade 8, teacher_8b) runs the principal stay-back path,
-- 5-A (grade 5, teacher_5a) the coordinator path. The seeded group "Grade 8
-- Basketball Team" belongs to teacher_8b and holds only c…001 (guardian_a's).
begin;
select plan(64);

-- ---- Fixture rows (as the migration owner) ----
insert into messages (id, subject, body, sender_id, scope_type) values
  ('10000000-0000-0000-0000-000000000001', 'Group note', 'x', 'b0000000-0000-0000-0000-000000000001', 'group');
insert into message_targets (message_id, custom_group_id)
select '10000000-0000-0000-0000-000000000001', id from custom_groups where name = 'Grade 8 Basketball Team';

insert into leave_requests (id, student_id, requested_by, from_date, to_date, reason) values
  ('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '2026-12-01', '2026-12-02', '8-B leave'),
  ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '2026-12-01', '2026-12-02', '5-A leave');

insert into stay_back_consents (id, student_id, raised_by_guardian_id, teacher_id, reason, stay_date, from_time, to_time) values
  ('30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000002', 'Practice', '2026-12-01', '15:00', '17:00');
insert into approval_steps (id, subject_type, subject_id, step_order, approver_role, approver_staff_id) values
  ('31000000-0000-0000-0000-000000000001', 'stay_back_consent', '30000000-0000-0000-0000-000000000001', 1, 'class_teacher', 'b0000000-0000-0000-0000-000000000002'),
  ('31000000-0000-0000-0000-000000000002', 'stay_back_consent', '30000000-0000-0000-0000-000000000001', 2, 'front_office', null),
  ('31000000-0000-0000-0000-000000000003', 'stay_back_consent', '30000000-0000-0000-0000-000000000001', 3, 'coordinator', null);

-- ---- Functions ----
select ok(not has_function_privilege('anon', 'public.is_staff()', 'execute'), 'anon cannot run is_staff()');
select ok(not has_function_privilege('anon', 'public.current_guardian_id()', 'execute'), 'anon cannot run current_guardian_id()');
select ok(not has_function_privilege('anon', 'public.is_leadership()', 'execute'), 'anon cannot run is_leadership()');
select ok(not has_function_privilege('anon', 'public.create_dtr_event(text, date, dtr_category, text, uuid[], uuid[])', 'execute'),
  'anon cannot run create_dtr_event()');
select ok(has_function_privilege('authenticated', 'public.is_staff()', 'execute'), 'authenticated can run is_staff()');

-- ---- Messages ----
select tests.authenticate_as('teacher_5a');
select is(tests.visible('messages', $$id = '10000000-0000-0000-0000-000000000001'$$), 1::bigint,
  'any staff member reads every message');
select lives_ok(
  $$insert into messages (id, subject, body, sender_id, scope_type)
    values ('10000000-0000-0000-0000-000000000002', 'Hi', 'x', 'b0000000-0000-0000-0000-000000000002', 'class')$$,
  'a teacher sends as themselves');
select lives_ok(
  $$insert into message_targets (message_id, class_section_id)
    values ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002')$$,
  'a teacher targets a class they teach');
select throws_ok(
  $$insert into message_targets (message_id, class_section_id)
    values ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a teacher cannot target a class they do not teach');
select throws_ok(
  $$insert into message_targets (message_id, student_id)
    values ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a teacher cannot target a student outside their classes');
select throws_ok(
  $$insert into message_targets (message_id, custom_group_id)
    select '10000000-0000-0000-0000-000000000002', id from custom_groups where name = 'Grade 8 Basketball Team'$$,
  '42501', null, 'a teacher cannot target a group that is not theirs');
select throws_ok(
  $$insert into message_targets (message_id, class_section_id)
    values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'a teacher cannot add targets to someone else''s message');
select throws_ok(
  $$insert into messages (subject, body, sender_id, scope_type)
    values ('Hi', 'x', 'b0000000-0000-0000-0000-000000000001', 'class')$$,
  '42501', null, 'a teacher cannot send as another staff member');
select throws_ok(
  $$insert into messages (subject, body, sender_id, scope_type)
    values ('All', 'x', 'b0000000-0000-0000-0000-000000000002', 'school')$$,
  '42501', null, 'a teacher cannot send school-wide');

select tests.authenticate_as('teacher_8b');
select lives_ok(
  $$insert into message_targets (message_id, custom_group_id)
    select '10000000-0000-0000-0000-000000000001', id from custom_groups where name = 'Grade 8 Basketball Team'
    on conflict do nothing$$,
  'a teacher targets their own group');

select tests.authenticate_as('front_office');
select lives_ok(
  $$insert into messages (subject, body, sender_id, scope_type)
    values ('All', 'x', 'b0000000-0000-0000-0000-000000000005', 'school')$$,
  'front office sends school-wide');

select tests.authenticate_as('guardian_a');
select is(tests.visible('messages', $$id = '10000000-0000-0000-0000-000000000001'$$), 1::bigint,
  'a parent whose child is in the group reads the group message');
select is(tests.visible('custom_group_students'), 1::bigint, 'a parent sees their own child''s group membership');
select tests.authenticate_as('guardian_b');
select is(tests.visible('messages', $$id = '10000000-0000-0000-0000-000000000001'$$), 0::bigint,
  'a parent whose child is not in the group cannot read it, even in the same class');
select is(tests.visible('custom_group_students'), 0::bigint, 'a parent sees no other child''s memberships');

-- ---- Classes ----
select tests.authenticate_as('teacher_8b');
select is(tests.affected($$update class_sections set section = 'B' where id = 'a0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a teacher cannot edit a class');
select throws_ok(
  $$insert into class_sections (academic_year, grade, section) values ('2026-27', '9', 'Z')$$,
  '42501', null, 'a teacher cannot add a class');
select tests.authenticate_as('accounts');
select is(tests.affected($$update class_sections set section = 'B' where id = 'a0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'accounts cannot edit a class');
select tests.authenticate_as('front_office');
select is(tests.affected($$update class_sections set section = 'B' where id = 'a0000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'front office edits a class');
select tests.authenticate_as('coordinator');
select lives_ok(
  $$insert into class_sections (id, academic_year, grade, section)
    values ('a0000000-0000-0000-0000-000000000009', '2026-27', '9', 'Z')$$,
  'coordinator adds a class');
select tests.authenticate_as('principal');
select is(tests.affected($$delete from class_sections where id = 'a0000000-0000-0000-0000-000000000009'$$),
  1::bigint, 'principal deletes a class');
select tests.authenticate_as('guardian_a');
select is(tests.visible('class_sections'), 2::bigint, 'a parent still reads classes');

-- ---- Leave ----
select tests.authenticate_as('teacher_8b');
select is(tests.visible('leave_requests'), 1::bigint, 'a class teacher sees only their class''s leave');
select is(tests.affected($$update leave_requests set status = 'approved' where id = '20000000-0000-0000-0000-000000000002'$$),
  0::bigint, 'a class teacher cannot decide another class''s leave');
select is(tests.affected($$update leave_requests set status = 'approved' where id = '20000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'a class teacher decides their class''s leave');
select tests.authenticate_as('accounts');
select is(tests.visible('leave_requests'), 0::bigint, 'accounts sees no leave');
select tests.authenticate_as('front_office');
select is(tests.visible('leave_requests'), 2::bigint, 'front office sees all leave');
select is(tests.affected($$update leave_requests set status = 'approved' where id = '20000000-0000-0000-0000-000000000002'$$),
  1::bigint, 'front office decides leave');
select tests.authenticate_as('coordinator');
select is(tests.visible('leave_requests'), 2::bigint, 'coordinator sees all leave');
select tests.authenticate_as('principal');
select is(tests.visible('leave_requests'), 2::bigint, 'principal sees all leave');
select is(tests.affected($$delete from leave_requests where id = '20000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'principal cannot delete leave');

-- ---- Stay-back (5-A: named teacher -> front office -> coordinator) ----
select tests.authenticate_as('front_office');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000001'$$), 0::bigint, 'front office cannot decide the teacher''s step');
select tests.authenticate_as('teacher_8b');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000001'$$), 0::bigint, 'another teacher cannot decide the named teacher''s step');
select tests.authenticate_as('teacher_5a');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000001'$$), 1::bigint, 'the named teacher decides their step');
select is(tests.affected($$update approval_steps set decision = 'declined'
  where id = '31000000-0000-0000-0000-000000000001'$$), 0::bigint, 'a decided step cannot be changed');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000002'$$), 0::bigint, 'a teacher cannot decide the front office step');
select throws_ok(
  $$insert into approval_steps (subject_type, subject_id, step_order, approver_role, decision)
    values ('stay_back_consent', '30000000-0000-0000-0000-000000000001', 9, 'principal', 'approved')$$,
  '42501', null, 'staff cannot insert a pre-decided step');
select tests.authenticate_as('front_office');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000002'$$), 1::bigint, 'front office decides their step');
select tests.authenticate_as('principal');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000003'$$), 0::bigint, 'principal cannot decide the coordinator''s step');
select tests.authenticate_as('accounts');
select is(tests.affected($$update stay_back_consents set status = 'approved' where id = '30000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'accounts cannot change a stay-back');
select tests.authenticate_as('coordinator');
select is(tests.affected($$update approval_steps set decision = 'approved', approver_staff_id = current_staff_id()
  where id = '31000000-0000-0000-0000-000000000003'$$), 1::bigint, 'coordinator decides the last step for grade 5');
select is(tests.affected($$update stay_back_consents set status = 'approved' where id = '30000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'coordinator closes the request');
select tests.authenticate_as('guardian_a');
select is(tests.visible('approval_steps', $$subject_id = '30000000-0000-0000-0000-000000000001'$$), 3::bigint,
  'the parent sees their request''s chain');

-- ---- Calendar ----
select tests.authenticate_as('teacher_8b');
select throws_ok(
  $$select create_dtr_event('Trip', '2026-12-05', 'event', null, '{}', '{}')$$,
  '42501', null, 'a teacher cannot add a school-wide event');
select throws_ok(
  $$select create_dtr_event('Trip', '2026-12-05', 'event', null, '{a0000000-0000-0000-0000-000000000002}', '{}')$$,
  '42501', null, 'a teacher cannot add an event for a class they do not teach');
select throws_ok(
  $$insert into dtr_events (title, event_date, category, created_by)
    values ('Trip', '2026-12-05', 'event', 'b0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a teacher cannot insert an event directly');
select lives_ok(
  $$select create_dtr_event('8-B trip', '2026-12-05', 'event', null, '{a0000000-0000-0000-0000-000000000001}', '{}')$$,
  'a teacher adds an event for their class');
select lives_ok(
  $$select create_dtr_event('Match', '2026-12-06', 'event', null, '{}',
      array[(select id from custom_groups where name = 'Grade 8 Basketball Team')])$$,
  'a teacher adds an event for their group');
select is(tests.affected($$update dtr_events set title = '8-B trip (moved)' where title = '8-B trip'$$),
  1::bigint, 'the creator edits their event');
select tests.authenticate_as('teacher_5a');
select is(tests.affected($$update dtr_events set title = 'x' where title = '8-B trip (moved)'$$),
  0::bigint, 'another teacher cannot edit it');
select is(tests.affected($$delete from dtr_events where title = 'Match'$$),
  0::bigint, 'another teacher cannot delete it');
select tests.authenticate_as('front_office');
select lives_ok(
  $$select create_dtr_event('Sports day', '2026-12-10', 'event')$$,
  'front office adds a school-wide event');
select is(tests.affected($$update dtr_events set title = 'Match (rescheduled)' where title = 'Match'$$),
  1::bigint, 'front office edits a teacher''s event');
select tests.authenticate_as('guardian_b');
select is(tests.visible('dtr_event_groups'), 1::bigint, 'parents read event targets');

-- ---- Super admin ----
select tests.authenticate_as('super_admin');
select is(tests.affected($$update messages set subject = 'Edited' where id = '10000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'super admin edits any message');
select is(tests.affected($$delete from leave_requests where id = '20000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'super admin deletes leave');
select ok(tests.affected($$update exam_results set marks = marks$$) > 0, 'super admin edits exam results');
select is(tests.affected($$update approval_steps set decision = 'declined' where id = '31000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'super admin overrides any approval step');
select is(tests.affected($$update dtr_events set title = 'Sports day!' where title = 'Sports day'$$),
  1::bigint, 'super admin edits any event');
reset role;

select * from finish();
rollback;
