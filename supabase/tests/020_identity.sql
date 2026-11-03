-- Identity tables (TODO 2B.1): staff, staff_directory, guardians, guardian_student,
-- students, class_sections. Fixture world: see 000_harness.sql. guardian_a has
-- c…001 (8-B) and c…002 (5-A); guardian_b has c…003 (8-B). Totals are captured
-- first so the counts hold however many rows seed.sql adds later.
begin;
select plan(55);

create temp table totals on commit drop as select
  (select count(*) from staff) as staff,
  (select count(*) from guardians) as guardians,
  (select count(*) from guardian_student) as links,
  (select count(*) from students) as students,
  (select count(*) from class_sections) as classes;
grant select on totals to anon, authenticated;

-- ---- Anonymous visitors see nothing ----
select tests.authenticate_anon();
select is(tests.visible('staff'), 0::bigint, 'anon: no staff');
select is(tests.visible('staff_directory'), 0::bigint, 'anon: no staff directory');
select is(tests.visible('guardians'), 0::bigint, 'anon: no guardians');
select is(tests.visible('guardian_student'), 0::bigint, 'anon: no guardian links');
select is(tests.visible('students'), 0::bigint, 'anon: no students');
select is(tests.visible('class_sections'), 0::bigint, 'anon: no classes');
reset role;

-- ---- A signed-in account that is neither staff nor guardian ----
select tests.authenticate_as('stranger');
select is(tests.visible('staff'), 0::bigint, 'stranger: no staff rows');
select is(tests.visible('guardians'), 0::bigint, 'stranger: no guardians');
select is(tests.visible('guardian_student'), 0::bigint, 'stranger: no guardian links');
select is(tests.visible('students'), 0::bigint, 'stranger: no students');
reset role;

-- ---- Parents: own family only, read-only ----
select tests.authenticate_as('guardian_a');
select is(tests.visible('staff'), 0::bigint, 'a parent cannot read the staff table');
select is(tests.visible('staff_directory'), (select staff from totals), 'a parent reads the staff directory');
select is(tests.visible('guardians'), 1::bigint, 'a parent sees only their own guardian row');
select is(tests.visible('guardians', $$id = 'd0000000-0000-0000-0000-000000000002'$$), 0::bigint,
  'a parent cannot see another family''s guardian');
select is(tests.visible('guardian_student'), 2::bigint, 'a parent sees their own two child links');
select is(tests.visible('students'), 2::bigint, 'a parent sees their own two children');
select is(tests.visible('students', $$id = 'c0000000-0000-0000-0000-000000000003'$$), 0::bigint,
  'a parent cannot see a classmate from another family');
select is(tests.affected($$update guardians set phone = '+919999999999' where id = 'd0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a parent cannot edit their own guardian row');
select is(tests.affected($$update guardians set phone = '+919999999999' where id = 'd0000000-0000-0000-0000-000000000002'$$),
  0::bigint, 'a parent cannot edit another guardian');
select is(tests.affected($$update students set first_name = 'x' where id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a parent cannot edit their child');
select throws_ok(
  $$insert into guardian_student (guardian_id, student_id)
    values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'a parent cannot link themselves to another child');
select is(tests.affected($$delete from guardian_student where guardian_id = 'd0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a parent cannot unlink their children');
select is(tests.affected($$update class_sections set section = 'Z'$$), 0::bigint, 'a parent cannot edit classes');
select tests.authenticate_as('guardian_b');
select is(tests.visible('students'), 1::bigint, 'the other parent sees only their one child');
select is(tests.visible('guardian_student'), 1::bigint, 'the other parent sees only their one link');
reset role;

-- ---- Teachers: read everything, write nothing ----
select tests.authenticate_as('teacher_8b');
select is(tests.visible('staff'), (select staff from totals), 'a teacher reads all staff');
select is(tests.visible('guardians'), (select guardians from totals), 'a teacher reads all guardians');
select is(tests.visible('guardian_student'), (select links from totals), 'a teacher reads all guardian links');
select is(tests.visible('students'), (select students from totals), 'a teacher reads all students');
select is(tests.affected($$update staff set name = 'x' where id = 'b0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a teacher cannot edit their own staff row');
select is(tests.affected($$update staff set role = 'principal' where id = 'b0000000-0000-0000-0000-000000000002'$$),
  0::bigint, 'a teacher cannot change another teacher''s role');
select throws_ok(
  $$insert into staff (name, role, username, email) values ('New', 'class_teacher', 'new.t', 'new.t@example.test')$$,
  '42501', null, 'a teacher cannot add staff');
select is(tests.affected($$update guardians set phone = '+919999999999'$$), 0::bigint, 'a teacher cannot edit guardians');
select is(tests.affected($$update students set first_name = 'x'$$), 0::bigint, 'a teacher cannot edit students');
select is(tests.affected($$delete from students where id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'a teacher cannot delete their own class''s student');
select throws_ok(
  $$insert into guardian_student (guardian_id, student_id)
    values ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a teacher cannot link guardians to students');
reset role;

-- ---- Front office: classes yes; staff, guardians and students no (app: requirePrincipal) ----
select tests.authenticate_as('front_office');
select is(tests.visible('students'), (select students from totals), 'front office reads all students');
select is(tests.affected($$update students set first_name = 'x' where id = 'c0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'front office cannot edit students');
select is(tests.affected($$update guardians set phone = '+919999999999' where id = 'd0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'front office cannot edit guardians');
select is(tests.affected($$update staff set name = 'x' where id = 'b0000000-0000-0000-0000-000000000001'$$),
  0::bigint, 'front office cannot edit staff');
reset role;

-- ---- Principal tier: manage students, guardians, links and non-super-admin staff ----
select tests.authenticate_as('principal');
select is(tests.affected($$update students set class_section_id = 'a0000000-0000-0000-0000-000000000002'
  where id = 'c0000000-0000-0000-0000-000000000003'$$), 1::bigint, 'principal moves a student to another class');
select is(tests.affected($$update guardians set phone = '+919999999999' where id = 'd0000000-0000-0000-0000-000000000002'$$),
  1::bigint, 'principal edits a guardian');
select lives_ok(
  $$insert into guardian_student (guardian_id, student_id)
    values ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001')$$,
  'principal links a guardian to a student');
select is(tests.affected($$update staff set name = 'Renamed' where id = 'b0000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'principal edits a teacher');
select is(tests.affected($$update staff set name = 'x' where id = 'b0000000-0000-0000-0000-000000000007'$$),
  0::bigint, 'principal cannot edit a super admin');
select throws_ok(
  $$update staff set role = 'super_admin' where id = 'b0000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'principal cannot promote anyone to super admin');
select is(tests.affected($$delete from staff where id = 'b0000000-0000-0000-0000-000000000007'$$),
  0::bigint, 'principal cannot delete a super admin');
select tests.authenticate_as('coordinator');
select lives_ok(
  $$insert into staff (id, name, role, username, email)
    values ('b0000000-0000-0000-0000-000000000099', 'New Teacher', 'class_teacher', 'new.teacher', 'new.teacher@example.test')$$,
  'coordinator adds a teacher');
select throws_ok(
  $$insert into staff (name, role, username, email) values ('Boss', 'super_admin', 'boss', 'boss@example.test')$$,
  '42501', null, 'coordinator cannot add a super admin');
select is(tests.affected($$update students set first_name = 'Edited' where id = 'c0000000-0000-0000-0000-000000000002'$$),
  1::bigint, 'coordinator edits a student');
reset role;

-- ---- Super admin: everything ----
select tests.authenticate_as('super_admin');
select is(tests.affected($$update staff set name = 'Still Super' where id = 'b0000000-0000-0000-0000-000000000007'$$),
  1::bigint, 'super admin edits a super admin');
select lives_ok(
  $$insert into staff (name, role, username, email) values ('Second Super', 'super_admin', 'super.two', 'super.two@example.test')$$,
  'super admin adds a super admin');
select is(tests.affected($$delete from staff where id = 'b0000000-0000-0000-0000-000000000099'$$),
  1::bigint, 'super admin deletes a staff member');
select is(tests.affected($$update guardians set relation = 'Aunt' where id = 'd0000000-0000-0000-0000-000000000001'$$),
  1::bigint, 'super admin edits a guardian');
reset role;

-- ---- The directory hides contact details ----
select columns_are('public', 'staff_directory', array['id', 'name', 'role', 'active'],
  'staff directory exposes only id, name, role and active');

select * from finish();
rollback;
