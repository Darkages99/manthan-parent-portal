-- New role assignable per-PTM: approves/denies that PTM's slot bookings.
-- Distinct from principal/super_admin/coordinator — not principal-tier.
alter type role add value if not exists 'admin';

-- Phone (and, already nullable, email) become optional on staff accounts —
-- OTP login/recovery just isn't available without one.
alter table staff alter column phone drop not null;

-- Link the real owner login (Google OAuth, sarangdrajgopaul@gmail.com) to a
-- super_admin staff row — it had no linked staff row at all, so it couldn't
-- get past the staff sign-in redirect.
insert into staff (auth_user_id, name, role, email, active)
select 'e0000000-0000-0000-0000-000000000001', 'Sarang', 'super_admin', 'sarangdrajgopaul@gmail.com', true
where not exists (select 1 from staff where auth_user_id = 'e0000000-0000-0000-0000-000000000001');
