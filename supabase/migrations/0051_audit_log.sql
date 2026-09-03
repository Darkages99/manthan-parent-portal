-- DG-3 (compliance/09) — versioned audit trail for edits to academic records.
--
-- Every INSERT/UPDATE/DELETE on exam_results (marks/grades) and attendance_records
-- is recorded here with who did it (staff id + auth uid), when, and the full
-- old/new row as JSON. This closes the "no versioned audit trail for academic
-- edits" governance gap: the school can now show the history of any mark change.
--
-- Rows are written ONLY by the SECURITY DEFINER trigger below (and by
-- erase_student() in 0052, which logs an 'ERASE' entry). No INSERT/UPDATE/DELETE
-- policy exists, so anon-key clients can never write or tamper with the log.
-- Reads are principal-tier only (it is an audit asset and may contain PII).

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE', 'ERASE')),
  actor_staff_id uuid,            -- current_staff_id(), null for service-role/background writes
  actor_auth_id uuid,            -- auth.uid(), null for service-role/background writes
  old_row jsonb,                 -- prior state (UPDATE/DELETE)
  new_row jsonb,                 -- new state (INSERT/UPDATE) or erase summary (ERASE)
  changed_at timestamptz not null default now()
);

create index audit_log_table_record_idx on audit_log (table_name, record_id);
create index audit_log_changed_at_idx on audit_log (changed_at);

alter table audit_log enable row level security;

drop policy if exists "principal-tier reads audit log" on audit_log;
create policy "principal-tier reads audit log" on audit_log for select
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

-- Generic row-change recorder. SECURITY DEFINER so it can insert into audit_log
-- regardless of the writer's RLS; search_path pinned per the project convention.
create or replace function public.audit_row_change()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into audit_log (table_name, record_id, operation, actor_staff_id, actor_auth_id, old_row, new_row)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    current_staff_id(),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return null; -- AFTER trigger; return value ignored
end $$;

revoke execute on function public.audit_row_change() from anon, public;

drop trigger if exists audit_exam_results on exam_results;
create trigger audit_exam_results
  after insert or update or delete on exam_results
  for each row execute function public.audit_row_change();

drop trigger if exists audit_attendance_records on attendance_records;
create trigger audit_attendance_records
  after insert or update or delete on attendance_records
  for each row execute function public.audit_row_change();
