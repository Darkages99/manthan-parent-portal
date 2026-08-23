-- No staff write policy has ever existed on `students` (only a guardian read
-- policy from 0001_init.sql) — Sheets sync writes bypass RLS via the
-- service-role client. The new Classes drag-and-drop (moving a student
-- between class sections) needs an app-layer, RLS-enforced write path.
-- Scoped to principal-equivalent roles, matching class_sections' admin-only
-- write intent, since moving a student is a class-management action.
drop policy if exists "principal manages students" on students;
create policy "principal manages students" on students for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
