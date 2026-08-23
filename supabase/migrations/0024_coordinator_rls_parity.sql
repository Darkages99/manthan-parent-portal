-- Coordinator was added to the role enum (0009_coordinator_role.sql) and to
-- every app-layer check (PRINCIPAL_ROLES in src/lib/roles.ts), but these five
-- write policies were never updated and still hardcode principal/super_admin
-- only. Coordinators pass the app-layer requirePrincipal() guard, so the UI
-- lets them try to save, but RLS silently drops the write (Supabase returns
-- success with a no-op) — it looks broken rather than throwing "not
-- authorized". Bring these in line with 0023_custom_group_staff_access.sql,
-- which already has the correct three-role shape.

drop policy if exists "principal manages subjects" on subjects;
create policy "principal manages subjects" on subjects for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

drop policy if exists "principal manages periods" on timetable_periods;
create policy "principal manages periods" on timetable_periods for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

drop policy if exists "principal manages timetable entries" on timetable_entries;
create policy "principal manages timetable entries" on timetable_entries for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

drop policy if exists "principal manages message send permissions" on message_send_permissions;
create policy "principal manages message send permissions" on message_send_permissions for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

drop policy if exists "principal manages competitions" on competitions;
create policy "principal manages competitions" on competitions for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
