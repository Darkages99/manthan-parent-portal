-- `staff` has never had row level security enabled — every other table in the
-- schema follows the is_staff()/current_staff_role() idiom, but this one was
-- missed, so any authenticated user (including guardians) could read AND
-- write the full staff table directly via the REST API, bypassing
-- requirePrincipal(). That's a real privilege-escalation gap, now more load
-- bearing since the staff-management screen writes role/active here. Reads
-- stay open to any authenticated user (staff and guardians both display
-- teacher names today); writes are principal-equivalent only.
alter table staff enable row level security;

drop policy if exists "authenticated reads staff" on staff;
create policy "authenticated reads staff" on staff for select
  using (auth.uid() is not null);

drop policy if exists "principal manages staff" on staff;
create policy "principal manages staff" on staff for all
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'))
  with check (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
