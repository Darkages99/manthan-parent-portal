-- 0001_init.sql declares push_subscriptions.endpoint as `unique`, but the
-- constraint was missing from the deployed database (drift from an earlier
-- apply). savePushSubscription() upserts on `endpoint`, which requires this
-- constraint to exist — without it, Postgres has no unique/exclusion match
-- for ON CONFLICT and every subscribe call fails.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_key unique (endpoint);
