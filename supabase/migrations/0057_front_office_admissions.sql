-- Front office handles admissions (user decision 2026-11-03): it may add and edit
-- students and parents, and link or unlink parents and children. Deleting a
-- student or a parent stays with the principal tier ("principal manages …"
-- policies from 0054, unchanged). The deferred integrity triggers from 0040 still
-- stop a student being left with no parent.
create policy "front office adds students" on students for insert
  with check (current_staff_role() = 'front_office');
create policy "front office edits students" on students for update
  using (current_staff_role() = 'front_office')
  with check (current_staff_role() = 'front_office');

create policy "front office adds guardians" on guardians for insert
  with check (current_staff_role() = 'front_office');
create policy "front office edits guardians" on guardians for update
  using (current_staff_role() = 'front_office')
  with check (current_staff_role() = 'front_office');

-- Insert and delete only: editing a parent's children replaces the links
-- (replace_guardian_children, security invoker).
create policy "front office links guardians" on guardian_student for insert
  with check (current_staff_role() = 'front_office');
create policy "front office unlinks guardians" on guardian_student for delete
  using (current_staff_role() = 'front_office');
