-- Stay-back form fields the principal asked for: purpose (with a fixed set of
-- categories plus free-text detail for "others"), and mode of transport.
-- Duration is already covered by the existing from_time/to_time columns.

create type stay_back_purpose as enum ('cultural', 'project', 'competitions_prep', 'ihc', 'others');

alter table stay_back_consents
  add column purpose stay_back_purpose not null default 'others',
  add column purpose_detail text,
  add column mode_of_transport text;
