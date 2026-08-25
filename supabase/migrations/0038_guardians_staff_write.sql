-- Mirrors "principal manages students" (0027_students_staff_write.sql): the
-- new staff-facing Parents section needs to create/edit/delete guardians and
-- their child links directly, not only through the Sheets sync service-role
-- job that previously had exclusive write access to this table.
create policy "principal manages guardians" on guardians for all
  using (current_staff_role() = any (array['principal', 'super_admin', 'coordinator']::role[]))
  with check (current_staff_role() = any (array['principal', 'super_admin', 'coordinator']::role[]));

create policy "principal manages guardian_student" on guardian_student for all
  using (current_staff_role() = any (array['principal', 'super_admin', 'coordinator']::role[]))
  with check (current_staff_role() = any (array['principal', 'super_admin', 'coordinator']::role[]));
