-- Reverts PTM booking to plain first-come-first-served: no per-meeting
-- multi-teacher assignment, no front-office approval step on a booking. A
-- meeting keeps its single "primary" teacher_id (the class teacher) and its
-- booking window; a slot is booked the instant a guardian claims it.
drop policy if exists "guardian books class ptm slots" on ptm_slots;
create policy "guardian books class ptm slots" on ptm_slots for update
  using (
    class_section_id in (
      select class_section_id from students
      where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
    )
    and meeting_id in (select id from ptm_meetings where status = 'open')
  )
  with check (
    (booked_by_guardian_id is null or booked_by_guardian_id = current_guardian_id())
    and (booked_student_id is null or booked_student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    ))
  );

drop policy if exists "staff reads ptm meeting teachers" on ptm_meeting_teachers;
drop policy if exists "principal-tier manages ptm meeting teachers" on ptm_meeting_teachers;
drop table if exists ptm_meeting_teachers;

alter table ptm_meetings drop column if exists assigned_admin_id;
alter table ptm_slots drop column if exists pending_guardian_id;
