-- ---------------------------------------------------------------------------
-- Attendance: rename 'excused' to 'half_day'. There's no real distinction
-- between "excused absence" and a half-day on this system — half days count
-- as 0.5 of a present day in attendance percentage calculations (app-level).
-- A rename preserves existing rows' data, it just relabels the enum value.
-- ---------------------------------------------------------------------------

alter type attendance_status rename value 'excused' to 'half_day';
