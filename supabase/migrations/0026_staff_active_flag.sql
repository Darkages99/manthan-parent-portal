-- Backs the new staff-management screen's deactivate action. No status flag
-- existed on staff before this — every account was implicitly active.
alter table staff add column if not exists active boolean not null default true;
