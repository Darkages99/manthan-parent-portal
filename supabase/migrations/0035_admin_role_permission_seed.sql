-- The 'admin' role (added in 0030_admin_role.sql) postdates the all-role seed
-- in 0016_message_send_permissions.sql, so it has no rows yet — the grid's
-- toggle is an UPDATE, not an upsert, so it would silently no-op without this.
insert into message_send_permissions (role, scope_type, allowed)
select 'admin', s, true
from unnest(enum_range(null::message_scope_type)) as s
on conflict (role, scope_type) do nothing;
