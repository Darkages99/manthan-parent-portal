-- Generic multi-step approval chain, shared by stay-back consents and (later)
-- PTM slot booking approval. Replaces bespoke decision columns per module with
-- one normalized table so a subject can require an arbitrary ordered set of
-- role approvals instead of a fixed two-party (teacher/principal) pattern.

create type approval_subject_type as enum ('stay_back_consent', 'ptm_slot_request');
create type approval_step_role as enum ('class_teacher', 'front_office', 'coordinator', 'principal');

create table approval_steps (
  id uuid primary key default gen_random_uuid(),
  subject_type approval_subject_type not null,
  subject_id uuid not null,
  step_order smallint not null,
  approver_role approval_step_role not null,
  approver_staff_id uuid references staff (id),
  decision approval_decision,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, step_order)
);

create index approval_steps_subject_idx on approval_steps (subject_type, subject_id);

alter table approval_steps enable row level security;

drop policy if exists "staff manage approval steps" on approval_steps;
create policy "staff manage approval steps" on approval_steps for all
  using (is_staff()) with check (is_staff());

-- Guardian read access is subject-type specific (each subject type has its own
-- ownership path). Combine both in one policy, following the same pattern as
-- "guardian reads own message_targets" (migration 0002). Extend with an OR
-- branch as new subject types are added.
drop policy if exists "guardian reads own approval steps" on approval_steps;
create policy "guardian reads own approval steps" on approval_steps for select
  using (
    (
      subject_type = 'stay_back_consent'
      and subject_id in (
        select id from stay_back_consents
        where student_id in (
          select student_id from guardian_student where guardian_id = current_guardian_id()
        )
      )
    )
    or (
      subject_type = 'ptm_slot_request'
      and subject_id in (
        select id from ptm_slots
        where class_section_id in (
          select class_section_id from students
          where id in (select student_id from guardian_student where guardian_id = current_guardian_id())
        )
      )
    )
  );
