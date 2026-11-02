-- RLS test harness (TODO 2B.0). `supabase test db` runs every file in this folder
-- through pg_prove in name order, so this one goes first. It is deliberately NOT
-- wrapped in a transaction: the helpers and fixture users below persist for the
-- rest of the run. Every other file opens a transaction, impersonates a user with
-- tests.authenticate_as(), asserts, and rolls back.
--
-- Fixture world (on top of seed.sql; fixed ids, re-runnable):
--   guardian_a   d...001  parent of c...001 (8-B) and c...002 (5-A)   [seed]
--   guardian_b   d...002  parent of c...003 (8-B)                     [here]
--   teacher_8b   b...001  class_teacher of 8-B                        [seed]
--   teacher_5a   b...002  class_teacher of 5-A                        [seed]
--   principal    b...003                                              [seed]
--   coordinator  b...004, front_office b...005,
--   super_admin  b...007                                              [here]
--   stranger     signed in, but neither staff nor guardian

create extension if not exists pgtap with schema extensions;

begin;
select plan(1);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create table if not exists tests.users (
  handle text primary key,
  id uuid not null unique
);
grant select on tests.users to anon, authenticated;

-- Sign in as a fixture user for the rest of the current transaction: switches to
-- the `authenticated` role and sets the JWT claims auth.uid() reads.
create or replace function tests.authenticate_as(p_handle text)
  returns void language plpgsql set search_path to ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from tests.users where handle = p_handle;
  if v_id is null then
    raise exception 'tests.authenticate_as: unknown test user %', p_handle;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
end
$$;

-- Act as a visitor with no session (the `anon` role, no claims).
create or replace function tests.authenticate_anon()
  returns void language plpgsql set search_path to ''
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end
$$;

-- visible() and affected() run caller SQL, so they keep the caller's search_path.
-- Rows of p_table the current role can see, optionally filtered. A role with no
-- table privilege at all counts as seeing nothing, so "anon ❌" holds whether it
-- is enforced by GRANTs or by RLS.
create or replace function tests.visible(p_table regclass, p_where text default 'true')
  returns bigint language plpgsql
as $$
declare
  v_count bigint;
begin
  execute format('select count(*) from %s where %s', p_table, p_where) into v_count;
  return v_count;
exception when insufficient_privilege then
  return 0;
end
$$;
-- Rows an INSERT/UPDATE/DELETE touched as the current role. RLS turns an
-- UPDATE or DELETE of a hidden row into 0 rows rather than an error.
create or replace function tests.affected(p_sql text)
  returns bigint language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---- Fixture rows ----
insert into staff (id, name, role, username, email) values
  ('b0000000-0000-0000-0000-000000000004','Test Coordinator','coordinator','test.coordinator','test.coordinator@example.test'),
  ('b0000000-0000-0000-0000-000000000005','Test Front Office','front_office','test.frontoffice','test.frontoffice@example.test'),
  ('b0000000-0000-0000-0000-000000000007','Test Super Admin','super_admin','test.superadmin','test.superadmin@example.test')
on conflict (id) do nothing;

insert into students (id, first_name, last_name, roll_no, class_section_id) values
  ('c0000000-0000-0000-0000-000000000003','Test','Child Three','2','a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into guardians (id, name, relation, phone, email) values
  ('d0000000-0000-0000-0000-000000000002','Other Guardian','Mother','+910000000002','other.guardian@example.test')
on conflict (id) do nothing;

insert into guardian_student (guardian_id, student_id) values
  ('d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- One auth user per handle (ids 0f…01–0f…10), linked to the matching domain row.
create temp table fixture_users (handle text, id uuid, staff_id uuid, guardian_id uuid) on commit drop;
insert into fixture_users values
  ('guardian_a',   '0f000000-0000-0000-0000-000000000001', null, 'd0000000-0000-0000-0000-000000000001'),
  ('guardian_b',   '0f000000-0000-0000-0000-000000000002', null, 'd0000000-0000-0000-0000-000000000002'),
  ('teacher_8b',   '0f000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', null),
  ('teacher_5a',   '0f000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', null),
  ('principal',    '0f000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', null),
  ('coordinator',  '0f000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004', null),
  ('front_office', '0f000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000005', null),
  ('super_admin',  '0f000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000007', null),
  ('stranger',     '0f000000-0000-0000-0000-000000000010', null, null);

insert into auth.users (id, aud, role, email)
select id, 'authenticated', 'authenticated', handle || '@rls.example.test' from fixture_users
on conflict (id) do nothing;

insert into tests.users (handle, id) select handle, id from fixture_users
on conflict (handle) do nothing;

update staff set auth_user_id = f.id from fixture_users f where staff.id = f.staff_id;
update guardians set auth_user_id = f.id from fixture_users f where guardians.id = f.guardian_id;

select is((select count(*) from tests.users), 9::bigint, 'harness: 9 fixture users installed');
select * from finish();
commit;
