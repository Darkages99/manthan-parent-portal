-- Proves the harness itself: impersonation reaches auth.uid() and the identity
-- helpers, RLS actually filters under it, writes are refused, and rollback leaves
-- nothing behind. The per-table suites (2B.1+) rely on all of this.
begin;
select plan(13);

-- Impersonation resolves to the right domain identity.
select tests.authenticate_as('guardian_a');
select is(auth.uid(), '0f000000-0000-0000-0000-000000000001'::uuid, 'auth.uid() is the impersonated user');
select is(current_user::text, 'authenticated', 'runs as the authenticated role');
select is(current_guardian_id(), 'd0000000-0000-0000-0000-000000000001'::uuid, 'guardian_a resolves to guardian d…001');
select ok(not is_staff(), 'a guardian is not staff');

select tests.authenticate_as('principal');
select is(current_staff_role(), 'principal'::role, 'principal resolves to role principal');

-- RLS filters: guardian sees own children, never another family's.
select tests.authenticate_as('guardian_a');
select is(tests.visible('students'), 2::bigint, 'guardian_a sees exactly their 2 children');
select is(tests.visible('students', $$id = 'c0000000-0000-0000-0000-000000000003'$$), 0::bigint,
  'guardian_a cannot see guardian_b''s child');

select tests.authenticate_as('guardian_b');
select is(tests.visible('students'), 1::bigint, 'guardian_b sees exactly their 1 child');

select tests.authenticate_as('stranger');
select is(tests.visible('students'), 0::bigint, 'a signed-in user with no role sees no students');

select tests.authenticate_anon();
select is(tests.visible('students'), 0::bigint, 'anon sees no students');

-- Writes outside policy: an INSERT is refused; an UPDATE matches no rows.
select tests.authenticate_as('guardian_a');
select throws_ok(
  $$insert into students (first_name, last_name, roll_no, class_section_id)
    values ('Fake', 'Child', '99', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'guardian cannot insert a student');
select is(tests.affected(
  $$update students set first_name = 'Hacked' where id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'guardian cannot update their own child''s student row');
reset role;

select is((select count(*) from students where first_name = 'Hacked'), 0::bigint, 'no write leaked');

select * from finish();
rollback;
