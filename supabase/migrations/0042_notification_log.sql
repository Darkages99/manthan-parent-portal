-- Durable record of every push notification attempt, so the school can prove
-- a parent was notified of X on date Y at time Z. Fed from the single shared
-- sendPush() call site (src/lib/notifications/push.ts) — every category
-- (leave, ptm, messages, stay_back, reminders, defaulters, consultations)
-- lands here automatically, no per-feature logging needed.
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('guardian', 'staff')),
  recipient_id uuid not null,
  category notification_category not null,
  title text not null,
  body text not null,
  delivered boolean not null,
  sent_at timestamptz not null default now()
);

create index notification_log_recipient_idx on notification_log (recipient_type, recipient_id);
create index notification_log_sent_at_idx on notification_log (sent_at);

alter table notification_log enable row level security;

-- Written only via the service-role admin client from sendPush(); staff reads
-- are gated to principal-tier here since this is an audit/proof log.
create policy "principal-tier reads notification log" on notification_log for select
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'));
