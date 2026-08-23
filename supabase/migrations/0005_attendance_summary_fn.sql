-- ---------------------------------------------------------------------------
-- Attendance term summary
--
-- The console attendance page and dashboard alerts need a per-student
-- present-percentage over the whole term. Pulling every attendance row to the
-- app to compute this client-side hit PostgREST's 1000-row response cap once
-- the table grew past a few thousand rows — so recent rows (today's marks!)
-- silently fell outside the returned window and nothing reflected in the UI.
--
-- This function aggregates in the database instead: one row per student,
-- regardless of history size. Weighting mirrors presentPercent() in
-- src/lib/attendance.ts — present/late = 1, half_day = 0.5, absent = 0.
--
-- SECURITY INVOKER (the default) so the existing attendance_records RLS still
-- applies: staff see all students, guardians see only their own.
-- ---------------------------------------------------------------------------
create or replace function public.attendance_summary(p_student_ids uuid[])
returns table (student_id uuid, total bigint, present_pct integer)
language sql
stable
as $$
  select
    ar.student_id,
    count(*)::bigint as total,
    round(
      sum(
        case ar.status
          when 'present' then 1.0
          when 'late' then 1.0
          when 'half_day' then 0.5
          else 0
        end
      ) / count(*) * 100
    )::int as present_pct
  from attendance_records ar
  where ar.student_id = any (p_student_ids)
  group by ar.student_id;
$$;
