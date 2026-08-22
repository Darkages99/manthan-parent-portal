-- PTM booking approval workflow: a guardian's booking request now provisionally
-- holds the slot (pending_guardian_id) while an approval_steps chain (admin
-- review -> cc teacher/coordinator -> final approval by assigned staff) runs;
-- booked_by_guardian_id is only set once that chain resolves to approved.
alter table ptm_slots
  add column pending_guardian_id uuid references guardians (id);

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
    and (pending_guardian_id is null or pending_guardian_id = current_guardian_id())
    and (booked_student_id is null or booked_student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    ))
  );
