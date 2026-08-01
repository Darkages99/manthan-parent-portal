import type { Enums } from "@/lib/supabase/database.types";

type Status = Enums<"attendance_status">;

/** School-wide minimum attendance. A student below this is flagged across the
 * parent portal, the console dashboard alerts, and the attendance analytics.
 * Single source of truth — do not hardcode 85 elsewhere. */
export const ATTENDANCE_THRESHOLD = 85;

/** Present-equivalent weight per status. Half days count as half a present day;
 * late still counts as attended. Absent is the only zero. */
const PRESENT_WEIGHT: Record<Status, number> = {
  present: 1,
  late: 1,
  half_day: 0.5,
  absent: 0,
};

/** Attendance percentage (0–100, rounded) over a set of records. Returns 0 for
 * an empty set. Mirrors the formula used in the parent attendance view. */
export function presentPercent(records: { status: Status }[]): number {
  if (records.length === 0) return 0;
  const weighted = records.reduce((sum, r) => sum + PRESENT_WEIGHT[r.status], 0);
  return Math.round((weighted / records.length) * 100);
}

/** True when a percentage is under the school minimum. */
export function isBelowThreshold(pct: number): boolean {
  return pct < ATTENDANCE_THRESHOLD;
}
