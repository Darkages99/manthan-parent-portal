-- Manthan Vidyashram Parent Portal — initial schema
-- Run via `supabase db push` once a project exists (see README "Backend setup").
-- Row-level security is the access-control backbone: a guardian can only ever
-- read rows joined through guardian_student, never the whole table.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- People & classes
-- ---------------------------------------------------------------------------

create type role as enum ('parent', 'class_teacher', 'front_office', 'accounts', 'principal', 'super_admin');

create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  name text not null,
  role role not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table class_sections (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null, -- e.g. '2026-27'
  grade text not null,
  section text not null,
  class_teacher_id uuid references staff (id),
  unique (academic_year, grade, section)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  roll_no text not null,
  class_section_id uuid not null references class_sections (id),
  photo_url text,
  created_at timestamptz not null default now()
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  name text not null,
  relation text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

create table guardian_student (
  guardian_id uuid not null references guardians (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  primary key (guardian_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Attendance & leave
-- ---------------------------------------------------------------------------

create type attendance_status as enum ('present', 'absent', 'late', 'excused');

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  date date not null,
  status attendance_status not null,
  marked_by uuid references staff (id),
  unique (student_id, date)
);

create type leave_status as enum ('pending', 'approved', 'declined');

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  requested_by uuid not null references guardians (id),
  from_date date not null,
  to_date date not null,
  reason text not null,
  status leave_status not null default 'pending',
  decided_by uuid references staff (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Stay-back consent
-- Parent-raised: names the teacher, reason, and timings. Both that teacher
-- and the principal are pushed a notification to approve; either decision
-- closes the request, the other party sees the outcome.
-- ---------------------------------------------------------------------------

create type stay_back_status as enum ('pending', 'approved', 'declined');
create type approval_decision as enum ('approved', 'declined');

create table stay_back_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  raised_by_guardian_id uuid not null references guardians (id),
  teacher_id uuid not null references staff (id), -- the specific teacher named by the parent
  reason text not null,
  stay_date date not null,
  from_time time not null,
  to_time time not null,
  status stay_back_status not null default 'pending',
  teacher_decision approval_decision,
  teacher_decided_at timestamptz,
  principal_decision approval_decision,
  principal_decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DTR — Dates To Remember (school calendar)
-- ---------------------------------------------------------------------------

create type dtr_category as enum ('exam', 'holiday', 'event', 'deadline', 'ptm', 'other');

create table dtr_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  category dtr_category not null,
  description text,
  created_by uuid references staff (id),
  created_at timestamptz not null default now()
);

-- null class_section_id on the join = whole-school event
create table dtr_event_classes (
  dtr_event_id uuid not null references dtr_events (id) on delete cascade,
  class_section_id uuid not null references class_sections (id) on delete cascade,
  primary key (dtr_event_id, class_section_id)
);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create type invoice_status as enum ('due', 'partially_paid', 'paid', 'overdue');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  fee_head text not null, -- e.g. 'Term 2 Tuition'
  amount_paise bigint not null,
  due_date date not null,
  status invoice_status not null default 'due',
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id),
  amount_paise bigint not null,
  gateway_reference text not null,
  receipt_pdf_url text, -- Firebase Storage URL
  paid_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PTM booking
-- ---------------------------------------------------------------------------

create table ptm_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references staff (id),
  class_section_id uuid not null references class_sections (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booked_by_guardian_id uuid references guardians (id),
  booked_student_id uuid references students (id)
);

-- ---------------------------------------------------------------------------
-- Exam results
-- ---------------------------------------------------------------------------

create table exam_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  term text not null, -- e.g. 'Term 2'
  subject text not null,
  marks numeric not null,
  max_marks numeric not null,
  grade text,
  report_card_pdf_url text -- Firebase Storage URL, set once generated
);

-- ---------------------------------------------------------------------------
-- Defaulters
-- ---------------------------------------------------------------------------

create table defaulter_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  incident_date date not null,
  description text not null,
  action_taken text,
  recorded_by uuid references staff (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table custom_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references staff (id),
  created_at timestamptz not null default now()
);

create table custom_group_students (
  custom_group_id uuid not null references custom_groups (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  primary key (custom_group_id, student_id)
);

create type message_scope_type as enum ('school', 'class', 'student', 'group');

create table messages (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  sender_id uuid not null references staff (id),
  scope_type message_scope_type not null,
  urgent boolean not null default false,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- one row per (message, target) — target meaning depends on scope_type
create table message_targets (
  message_id uuid not null references messages (id) on delete cascade,
  class_section_id uuid references class_sections (id),
  student_id uuid references students (id),
  custom_group_id uuid references custom_groups (id)
);

create table message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages (id) on delete cascade,
  file_name text not null,
  storage_url text not null, -- Firebase Storage URL
  size_bytes bigint not null
);

-- delivery/read tracking, one row per resolved recipient guardian
create table message_receipts (
  message_id uuid not null references messages (id) on delete cascade,
  guardian_id uuid not null references guardians (id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, guardian_id)
);

-- ---------------------------------------------------------------------------
-- Push subscriptions (Web Push)
-- ---------------------------------------------------------------------------

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid references guardians (id) on delete cascade,
  staff_id uuid references staff (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(guardian_id, staff_id) = 1)
);

-- ---------------------------------------------------------------------------
-- Row-level security (enable now, policies added alongside auth wiring)
-- ---------------------------------------------------------------------------

alter table students enable row level security;
alter table guardians enable row level security;
alter table attendance_records enable row level security;
alter table leave_requests enable row level security;
alter table stay_back_consents enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table exam_results enable row level security;
alter table defaulter_records enable row level security;
alter table messages enable row level security;
alter table message_receipts enable row level security;

-- Example policy shape (uncomment and adapt once auth_user_id is populated):
-- create policy "guardians see only their own linked students"
--   on students for select
--   using (
--     id in (
--       select gs.student_id from guardian_student gs
--       join guardians g on g.id = gs.guardian_id
--       where g.auth_user_id = auth.uid()
--     )
--   );
