-- 0001_init.sql declares push_subscriptions.endpoint as `unique`, but the
-- constraint was missing from the deployed database (drift from an earlier
-- apply). savePushSubscription() upserts on `endpoint`, which requires this
-- constraint to exist — without it, Postgres has no unique/exclusion match
-- for ON CONFLICT and every subscribe call fails.
--
-- Originally 0005_push_subscriptions_endpoint_unique.sql. Renamed to its live
-- version (it shared 0005 with attendance_summary_fn, and a replay records each
-- version once) and guarded, because on a fresh replay 0001 has already created
-- the constraint. Live is unaffected: it applied this as 20260801170328.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_endpoint_key'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_endpoint_key unique (endpoint);
  end if;
end $$;
