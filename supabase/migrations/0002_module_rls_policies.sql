-- Manthan Parent Portal — RLS for the remaining modules
-- (attendance, results, defaulters, PTM booking, custom groups, group message
-- targeting). Mirrors the established idiom: guardians read only rows joined
-- through guardian_student via current_guardian_id(); staff (is_staff()) get
-- full access. Applied to the live project as migration 0002.

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
drop policy if exists "guardian reads own attendance" on attendance_records;
create policy "guardian reads own attendance" on attendance_records for select
  using (student_id in (select student_id from guardian_student where guardian_id = current_guardian_id()));
drop policy if exists "staff full access to attendance" on attendance_records;
create policy "staff full access to attendance" on attendance_records for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- Exam results
-- ---------------------------------------------------------------------------
drop policy if exists "guardian reads own results" on exam_results;
create policy "guardian reads own results" on exam_results for select
  using (student_id in (select student_id from guardian_student where guardian_id = current_guardian_id()));
drop policy if exists "staff full access to results" on exam_results;
create policy "staff full access to results" on exam_results for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- Defaulter records
-- ---------------------------------------------------------------------------
drop policy if exists "guardian reads own defaulters" on defaulter_records;
create policy "guardian reads own defaulters" on defaulter_records for select
  using (student_id in (select student_id from guardian_student where guardian_id = current_guardian_id()));
drop policy if exists "staff full access to defaulters" on defaulter_records;
create policy "staff full access to defaulters" on defaulter_records for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- PTM slots — guardians see slots for their children's classes and may book
-- (write booked_by/booked_student) or cancel their own booking.
-- ---------------------------------------------------------------------------
drop policy if exists "guardian reads class ptm slots" on ptm_slots;
create policy "guardian reads class ptm slots" on ptm_slots for select
  using (
    class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
  );
drop policy if exists "guardian books class ptm slots" on ptm_slots;
create policy "guardian books class ptm slots" on ptm_slots for update
  using (
    class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
  )
  with check (
    (booked_by_guardian_id is null or booked_by_guardian_id = current_guardian_id())
    and (booked_student_id is null or booked_student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    ))
  );
drop policy if exists "staff full access to ptm slots" on ptm_slots;
create policy "staff full access to ptm slots" on ptm_slots for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- Custom groups (staff-managed; used for message targeting)
-- ---------------------------------------------------------------------------
alter table custom_groups enable row level security;
drop policy if exists "staff full access to custom_groups" on custom_groups;
create policy "staff full access to custom_groups" on custom_groups for all
  using (is_staff()) with check (is_staff());
alter table custom_group_students enable row level security;
drop policy if exists "staff full access to custom_group_students" on custom_group_students;
create policy "staff full access to custom_group_students" on custom_group_students for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- Extend guardian message visibility to cover custom-group targeting
-- (recreate the two guardian-read policies with the added group path).
-- ---------------------------------------------------------------------------
drop policy if exists "guardian reads own message_targets" on message_targets;
create policy "guardian reads own message_targets" on message_targets for select
  using (
    (class_section_id is not null and class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    ))
    or (student_id is not null and student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    ))
    or (custom_group_id is not null and custom_group_id in (
      select custom_group_id from custom_group_students
      where student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    ))
  );

drop policy if exists "guardian reads relevant messages" on messages;
create policy "guardian reads relevant messages" on messages for select
  using (
    scope_type = 'school'::message_scope_type
    or id in (
      select mt.message_id from message_targets mt
      where (mt.class_section_id is not null and mt.class_section_id in (
              select class_section_id from students
              where id in (select student_id from guardian_student where guardian_id = current_guardian_id())))
        or (mt.student_id is not null and mt.student_id in (
              select student_id from guardian_student where guardian_id = current_guardian_id()))
        or (mt.custom_group_id is not null and mt.custom_group_id in (
              select custom_group_id from custom_group_students
              where student_id in (select student_id from guardian_student where guardian_id = current_guardian_id())))
    )
  );
