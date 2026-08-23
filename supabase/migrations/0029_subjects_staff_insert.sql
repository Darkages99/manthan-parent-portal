-- Any signed-in staff member may add a new subject (e.g. picking "Other" on
-- the homework form). Update/delete stays principal-tier via the existing
-- "principal manages subjects" ALL policy from 0024 — Postgres RLS policies
-- are OR'd per operation, so this only widens INSERT.
drop policy if exists "staff inserts subjects" on subjects;
create policy "staff inserts subjects" on subjects for insert
  with check (is_staff());
