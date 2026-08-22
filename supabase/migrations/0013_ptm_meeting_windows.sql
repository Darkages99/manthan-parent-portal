-- Configurable booking window + enforced slot length per meeting (previously
-- createSlots took an arbitrary start/end/duration with only a 5-minute floor
-- and no fixed structure at all).
alter table ptm_meetings
  add column window_start time,
  add column window_end time,
  add column slot_minutes smallint not null default 15;
