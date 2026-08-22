-- Admin-configurable control over which staff role may send to which message
-- scope. Seeded all-true for every role x scope_type combination so behavior
-- doesn't regress on deploy (today any staff role can send to any scope).
create table message_send_permissions (
  role role not null,
  scope_type message_scope_type not null,
  allowed boolean not null default true,
  primary key (role, scope_type)
);

insert into message_send_permissions (role, scope_type, allowed)
select r, s, true
from unnest(enum_range(null::role)) as r
cross join unnest(enum_range(null::message_scope_type)) as s
on conflict (role, scope_type) do nothing;

alter table message_send_permissions enable row level security;

drop policy if exists "authenticated reads message send permissions" on message_send_permissions;
create policy "authenticated reads message send permissions" on message_send_permissions for select
  using (auth.uid() is not null);

drop policy if exists "principal manages message send permissions" on message_send_permissions;
create policy "principal manages message send permissions" on message_send_permissions for all
  using (current_staff_role() in ('principal', 'super_admin'))
  with check (current_staff_role() in ('principal', 'super_admin'));
