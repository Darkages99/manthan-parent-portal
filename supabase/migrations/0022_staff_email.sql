-- Nullable email on staff, needed to share the provisioned Google Sheet
-- (Drive permissions.create) with principal/super_admin staff. Staff sign in
-- by phone/OTP today; email is optional roster metadata, not an auth field.
alter table staff add column if not exists email text;
