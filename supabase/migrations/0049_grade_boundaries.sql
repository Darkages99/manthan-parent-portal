-- Manthan Parent Portal — subject-level grade boundaries + max marks
-- Lets a teacher configure, once per subject+term, the max marks for that
-- exam and the percentage bands that map to each letter grade (e.g. 80-90 =
-- A). Marks entry then auto-fills grade from these bands instead of the
-- teacher picking a letter manually every time. Scoped by subject+term only
-- (not per class) — the same exam/subject is assumed to share one grading
-- scale across every class that sits it.

create table subject_grading_config (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  term text not null,
  max_marks numeric not null default 100,
  updated_at timestamptz not null default now(),
  unique (subject, term)
);

create table grade_boundaries (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  term text not null,
  grade text not null,
  min_pct numeric not null,
  max_pct numeric not null,
  unique (subject, term, grade)
);

alter table subject_grading_config enable row level security;
alter table grade_boundaries enable row level security;

-- Same idiom as exam_results (0002): any staff member can read/write at the
-- RLS layer; which subjects they're actually allowed to configure is
-- enforced in the server action (see results-scope.ts / results/subject/actions.ts).
drop policy if exists "staff full access to grading config" on subject_grading_config;
create policy "staff full access to grading config" on subject_grading_config for all
  using (is_staff()) with check (is_staff());

drop policy if exists "staff full access to grade boundaries" on grade_boundaries;
create policy "staff full access to grade boundaries" on grade_boundaries for all
  using (is_staff()) with check (is_staff());
