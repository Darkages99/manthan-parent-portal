-- Student QR codes — one stable, opaque token per student, used to identify a
-- child by scan (attendance and other flows). The token is deliberately separate
-- from students.id so a lost/copied card can be rotated without touching the
-- student record. Principal / super_admin generate and rotate; all staff read
-- (they do the scanning); guardians may read their own child's.
-- Applied to the live project as migration 0003.

create or replace function public.is_principal()
  returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists(
    select 1 from staff
    where auth_user_id = auth.uid() and role in ('principal', 'super_admin')
  )
$function$;

create table student_qr_codes (
  student_id uuid primary key references students (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  issued_at timestamptz not null default now(),
  issued_by uuid references staff (id)
);

alter table student_qr_codes enable row level security;

-- Read: any staff member (for scanning/lookup) or the child's own guardian.
drop policy if exists "staff and guardians read qr" on student_qr_codes;
create policy "staff and guardians read qr" on student_qr_codes for select
  using (
    is_staff()
    or student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    )
  );

-- Write (generate / regenerate / alter): principal and super_admin only.
drop policy if exists "principal manages qr" on student_qr_codes;
create policy "principal manages qr" on student_qr_codes for all
  using (is_principal()) with check (is_principal());
