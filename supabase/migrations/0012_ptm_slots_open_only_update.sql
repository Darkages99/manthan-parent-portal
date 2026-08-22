-- Bug fix: closing a PTM meeting (ptm_meetings.status = 'closed') never
-- actually locked its slots — this policy only checked class-section
-- ownership, not the parent meeting's status, so parents could still book
-- into a meeting the teacher had closed. Add the meeting-status condition.
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
