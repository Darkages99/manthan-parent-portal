-- Competitions & Olympiads section (phase 2 item) — informational listing
-- (NSO/IMO/IEO/Asset etc.), no in-app registration per the source document.
create table competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  exam_date date,
  registration_deadline date,
  external_link text,
  created_by uuid references staff (id),
  created_at timestamptz not null default now()
);

alter table competitions enable row level security;

drop policy if exists "authenticated reads competitions" on competitions;
create policy "authenticated reads competitions" on competitions for select
  using (auth.uid() is not null);
drop policy if exists "principal manages competitions" on competitions;
create policy "principal manages competitions" on competitions for all
  using (current_staff_role() in ('principal', 'super_admin'))
  with check (current_staff_role() in ('principal', 'super_admin'));
