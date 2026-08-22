-- Add the coordinator role, needed by the expanded stay-back and PTM approval
-- chains (migrations 0011+). Must be its own migration: Postgres requires a
-- new enum value to be committed before it can be referenced elsewhere.
alter type role add value 'coordinator';
