-- The partial unique indexes from 0015 don't match the plain
-- (guardian_id, category) / (staff_id, category) conflict target the app's
-- upsert() sends, so every preference toggle threw "no unique or exclusion
-- constraint matching the ON CONFLICT specification" and got silently
-- reverted client-side. Postgres unique indexes already treat NULLs as
-- distinct, so a non-partial index is equivalent for this owner-XOR pattern
-- and matches the upsert target.
drop index if exists notification_preferences_guardian_category_idx;
drop index if exists notification_preferences_staff_category_idx;

create unique index notification_preferences_guardian_category_idx
  on notification_preferences (guardian_id, category);
create unique index notification_preferences_staff_category_idx
  on notification_preferences (staff_id, category);
