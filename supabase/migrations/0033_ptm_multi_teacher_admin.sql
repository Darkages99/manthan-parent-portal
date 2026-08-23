-- A PTM can now involve more than one teacher (all get notified on a booking
-- decision); ptm_meetings.teacher_id stays as the "primary" teacher used for
-- slot generation, and is always also present in this join table.
create table ptm_meeting_teachers (
  meeting_id uuid not null references ptm_meetings(id) on delete cascade,
  teacher_id uuid not null references staff(id) on delete cascade,
  primary key (meeting_id, teacher_id)
);

insert into ptm_meeting_teachers (meeting_id, teacher_id)
select id, teacher_id from ptm_meetings
on conflict do nothing;

alter table ptm_meetings add column if not exists assigned_admin_id uuid references staff(id);

alter table ptm_meeting_teachers enable row level security;

create policy "staff reads ptm meeting teachers" on ptm_meeting_teachers for select
  using (is_staff());

create policy "principal-tier manages ptm meeting teachers" on ptm_meeting_teachers for all
  using (current_staff_role() in ('principal', 'super_admin'))
  with check (current_staff_role() in ('principal', 'super_admin'));
