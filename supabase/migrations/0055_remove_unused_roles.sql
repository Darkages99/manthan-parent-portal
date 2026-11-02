-- Remove the unused staff roles (TODO "role cleanup", agreed with the school on
-- 2026-11-02): 'admin' (retired in 0053), 'parent' (parents are guardians, never
-- staff) and 'accounts' (the same job as front office). Checked against the live
-- database before writing: 2 staff had 'accounts', none had 'parent' or 'admin';
-- message_send_permissions had 4 rows each for 'accounts' and 'parent'; no policy,
-- function body or constraint names 'accounts' or 'parent'.
--
-- Postgres cannot drop an enum value, so the type is rebuilt. Everything that
-- depends on it is dropped first and recreated afterwards: the policies that use
-- the type or call current_staff_role() (captured from the catalog, so the
-- recreated policies are exactly the ones that existed), the function itself,
-- the staff_directory view and the two CHECK constraints from 0053 that only
-- existed to keep 'admin' out.
--
-- Also fixes staff_directory's grants. 0050 meant it to be read-only, but the
-- schema's default privileges had already granted ALL to authenticated, and 0050
-- only revoked from anon/public, so any signed-in user (parents included) could
-- update staff rows (names, roles) through the definer view. It is recreated
-- with SELECT only.

-- ---------------------------------------------------------------------------
-- 1. Data
-- ---------------------------------------------------------------------------
update staff set role = 'front_office' where role = 'accounts';
delete from message_send_permissions where role in ('accounts', 'parent', 'admin');

do $$
begin
  if exists (select 1 from staff where role in ('accounts', 'parent', 'admin')) then
    raise exception 'staff still hold a role being removed';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Capture and drop the dependent policies
-- ---------------------------------------------------------------------------
create temp table _role_policies on commit drop as
select
  p.polname,
  p.polrelid::regclass as tbl,
  format(
    'create policy %I on %s as %s for %s to %s%s%s',
    p.polname,
    p.polrelid::regclass,
    case when p.polpermissive then 'permissive' else 'restrictive' end,
    case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update'
                  when 'd' then 'delete' else 'all' end,
    (select string_agg(case when r = 0 then 'public' else quote_ident(pg_get_userbyid(r)) end, ', ')
       from unnest(p.polroles) r),
    case when p.polqual is not null then ' using (' || pg_get_expr(p.polqual, p.polrelid) || ')' else '' end,
    case when p.polwithcheck is not null then ' with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')' else '' end
  ) as ddl
from pg_policy p
where p.oid in (
  select objid from pg_depend
  where classid = 'pg_policy'::regclass
    and refobjid in ('public.role'::regtype, 'public.current_staff_role()'::regprocedure)
);

do $$
declare r record;
begin
  for r in select * from _role_policies loop
    execute format('drop policy %I on %s', r.polname, r.tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Rebuild the type
-- ---------------------------------------------------------------------------
drop view staff_directory;
drop function current_staff_role();
alter table staff drop constraint if exists staff_role_not_admin;
alter table message_send_permissions drop constraint if exists message_send_permissions_role_not_admin;

alter type role rename to role_old;
create type role as enum ('class_teacher', 'front_office', 'coordinator', 'principal', 'super_admin');

alter table staff alter column role type role using role::text::role;
alter table message_send_permissions alter column role type role using role::text::role;

drop type role_old;

-- ---------------------------------------------------------------------------
-- 4. Recreate the function, the view and the policies
-- ---------------------------------------------------------------------------
create function current_staff_role() returns role
  language sql stable security definer set search_path = public
as $$
  select role from staff where auth_user_id = auth.uid()
$$;
revoke all on function current_staff_role() from public, anon;
grant execute on function current_staff_role() to authenticated, service_role;

create view staff_directory with (security_invoker = false) as
  select id, name, role, active from staff;
revoke all on staff_directory from public, anon, authenticated;
grant select on staff_directory to authenticated;
grant all on staff_directory to service_role;

do $$
declare r record; n int := 0;
begin
  for r in select * from _role_policies loop
    execute r.ddl;
    n := n + 1;
  end loop;
  if n = 0 then
    raise exception 'no dependent policies were captured';
  end if;
end $$;
