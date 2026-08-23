-- Login identifier for staff accounts that don't have a real email — password
-- sign-in falls back to "<username>@staff.manthan.internal" as the Supabase
-- Auth identity when no personal email is set (see createStaffAccount).
alter table staff add column if not exists username text;

update staff
set username = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g')) || '_' || substr(id::text, 1, 4)
where username is null;

alter table staff alter column username set not null;

drop index if exists staff_username_key;
create unique index staff_username_key on staff (lower(username));
