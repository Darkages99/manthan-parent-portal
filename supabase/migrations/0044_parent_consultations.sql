-- Parent Consultations: a parent requests an off-cycle meeting on a Tuesday
-- or Thursday, tells the school when they're free (free text), and front
-- office or principal schedules an actual time. Separate from PTM — no
-- teacher assignment, no slots, single decision-maker.
create type consultation_status as enum ('pending', 'scheduled', 'declined', 'cancelled');

create table parent_consultations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  requested_by uuid not null references guardians (id),
  preferred_date date not null,
  availability_note text not null,
  status consultation_status not null default 'pending',
  scheduled_time time,
  decided_by uuid references staff (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  constraint preferred_date_is_tue_or_thu check (extract(dow from preferred_date) in (2, 4))
);

create index parent_consultations_student_idx on parent_consultations (student_id);

alter table parent_consultations enable row level security;

create policy "guardian reads own consultations" on parent_consultations for select
  using (
    student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    )
  );

create policy "guardian requests consultation" on parent_consultations for insert
  with check (
    requested_by = current_guardian_id()
    and student_id in (
      select student_id from guardian_student where guardian_id = current_guardian_id()
    )
  );

create policy "guardian cancels own consultation" on parent_consultations for update
  using (requested_by = current_guardian_id())
  with check (requested_by = current_guardian_id() and status = 'cancelled');

create policy "staff manages consultations" on parent_consultations for all
  using (is_staff())
  with check (is_staff());
