-- Data-integrity rules:
--   Rule 1 — a student must have at least one linked guardian.
--   Rule 2 — a guardian must have a linked student OR a non-empty email.
--
-- Enforced with DEFERRABLE INITIALLY DEFERRED constraint triggers (checked at
-- COMMIT) so that:
--   * a single transaction can insert a row together with its links, and
--   * a cascade delete of a whole student/guardian doesn't trip the check for
--     rows that are themselves being removed.
-- Multi-row link changes (create student, replace a guardian's children, the
-- Sheets-sync guardian upsert) go through the SECURITY INVOKER RPCs at the end
-- of this file so they run inside one transaction.
--
-- NOTE on the Sheets sync: it inserts students first and links their guardians
-- in a later pass, so we do NOT put an insert-time trigger on `students` (that
-- would reject a valid two-pass import). Rule 1 is instead enforced against the
-- two vectors that matter: the manual "Add student" flow (via the RPC, which
-- requires a parent) and any later removal of a student's last guardian link.

-- ---------------------------------------------------------------------------
-- One-off cleanup of any existing violators (idempotent; currently a no-op —
-- the live data is already compliant). Looped because deleting an orphan parent
-- can orphan a student and vice-versa.
-- ---------------------------------------------------------------------------
do $$
declare
  removed_g integer;
  removed_s integer;
begin
  loop
    delete from guardians g
    where (g.email is null or btrim(g.email) = '')
      and not exists (select 1 from guardian_student gs where gs.guardian_id = g.id);
    get diagnostics removed_g = row_count;

    delete from students s
    where not exists (select 1 from guardian_student gs where gs.student_id = s.id);
    get diagnostics removed_s = row_count;

    exit when removed_g = 0 and removed_s = 0;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Trigger functions (SECURITY DEFINER so link counts are accurate regardless of
-- the caller's RLS).
-- ---------------------------------------------------------------------------

-- Rule 2: validate a single guardian.
create or replace function public.enforce_guardian_valid()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  -- guardian removed in this transaction — nothing to validate
  if not exists (select 1 from guardians where id = NEW.id) then
    return null;
  end if;
  if exists (
    select 1 from guardians g
    where g.id = NEW.id and g.email is not null and btrim(g.email) <> ''
  ) then
    return null;
  end if;
  if exists (select 1 from guardian_student where guardian_id = NEW.id) then
    return null;
  end if;
  raise exception 'A parent must have a linked child or an email address'
    using errcode = 'check_violation';
end $$;

-- Rules 1 & 2: when a link is added or removed, re-validate the affected student
-- (>= 1 guardian) and the affected guardian (child-or-email).
create or replace function public.enforce_link_valid()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_student uuid := coalesce(NEW.student_id, OLD.student_id);
  v_guardian uuid := coalesce(NEW.guardian_id, OLD.guardian_id);
begin
  -- Rule 1: the student, if it still exists, must keep at least one guardian.
  if exists (select 1 from students where id = v_student)
     and not exists (select 1 from guardian_student where student_id = v_student) then
    raise exception 'A student must have at least one parent'
      using errcode = 'check_violation';
  end if;

  -- Rule 2: the guardian, if it still exists, must keep a child or an email.
  if exists (select 1 from guardians where id = v_guardian)
     and not exists (
       select 1 from guardians g
       where g.id = v_guardian and g.email is not null and btrim(g.email) <> ''
     )
     and not exists (select 1 from guardian_student where guardian_id = v_guardian) then
    raise exception 'A parent must have a linked child or an email address'
      using errcode = 'check_violation';
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Constraint triggers (deferred to commit).
-- ---------------------------------------------------------------------------
drop trigger if exists guardian_valid on guardians;
create constraint trigger guardian_valid
  after insert or update on guardians
  deferrable initially deferred
  for each row execute function public.enforce_guardian_valid();

drop trigger if exists link_valid on guardian_student;
create constraint trigger link_valid
  after insert or delete on guardian_student
  deferrable initially deferred
  for each row execute function public.enforce_link_valid();

-- ---------------------------------------------------------------------------
-- Atomic RPCs (SECURITY INVOKER — existing RLS still gates who may write).
-- ---------------------------------------------------------------------------

-- Params with a DEFAULT must come last, so the nullable ones are ordered after
-- the required ones. Drop any earlier signature first.
drop function if exists public.create_student_with_guardians(text, text, text, uuid, text, uuid[]);
drop function if exists public.sync_upsert_guardian(uuid, text, text, text, text, uuid[]);

-- Manual "Add student": insert the student and its guardian links together.
create or replace function public.create_student_with_guardians(
  p_first_name text,
  p_last_name text,
  p_roll_no text,
  p_class_section_id uuid,
  p_guardian_ids uuid[],
  p_photo_url text default null
) returns uuid language plpgsql security invoker as $$
declare
  new_id uuid;
  gid uuid;
begin
  if p_guardian_ids is null or array_length(p_guardian_ids, 1) is null then
    raise exception 'A student must have at least one parent';
  end if;
  insert into students (first_name, last_name, roll_no, class_section_id, photo_url)
  values (p_first_name, p_last_name, p_roll_no, p_class_section_id, p_photo_url)
  returning id into new_id;
  foreach gid in array p_guardian_ids loop
    insert into guardian_student (guardian_id, student_id) values (gid, new_id);
  end loop;
  return new_id;
end $$;

-- Manual "Edit parent": replace a guardian's full set of children atomically.
create or replace function public.replace_guardian_children(
  p_guardian uuid,
  p_student_ids uuid[]
) returns void language plpgsql security invoker as $$
declare
  sid uuid;
begin
  delete from guardian_student where guardian_id = p_guardian;
  if p_student_ids is not null then
    foreach sid in array p_student_ids loop
      insert into guardian_student (guardian_id, student_id) values (p_guardian, sid);
    end loop;
  end if;
end $$;

-- Sheets sync: upsert a guardian and replace its children in one transaction so
-- an email-less-but-linked guardian passes the deferred checks.
create or replace function public.sync_upsert_guardian(
  p_name text,
  p_relation text,
  p_phone text,
  p_student_ids uuid[],
  p_id uuid default null,
  p_email text default null
) returns uuid language plpgsql security invoker as $$
declare
  gid uuid;
  sid uuid;
begin
  if p_id is null then
    insert into guardians (name, relation, phone, email)
    values (p_name, p_relation, p_phone, p_email)
    returning id into gid;
  else
    update guardians set name = p_name, relation = p_relation, phone = p_phone, email = p_email
    where id = p_id;
    gid := p_id;
  end if;
  delete from guardian_student where guardian_id = gid;
  if p_student_ids is not null then
    foreach sid in array p_student_ids loop
      insert into guardian_student (guardian_id, student_id) values (gid, sid);
    end loop;
  end if;
  return gid;
end $$;
