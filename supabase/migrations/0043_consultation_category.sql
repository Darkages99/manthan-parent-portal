-- New notification category for Parent Consultations (see 0044_parent_consultations.sql).
-- Kept in its own migration since a freshly added enum value can't be used in
-- the same transaction it's created in.
alter type notification_category add value 'consultations';
