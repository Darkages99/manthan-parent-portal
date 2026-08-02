import type { Tables } from "@/lib/supabase/database.types";

export type Period = Tables<"timetable_periods">;
export type TimetableEntry = Tables<"timetable_entries">;

/** School week: Monday (1) through Saturday (6). day_of_week matches these. */
export const DAYS = [
  { n: 1, label: "Mon", full: "Monday" },
  { n: 2, label: "Tue", full: "Tuesday" },
  { n: 3, label: "Wed", full: "Wednesday" },
  { n: 4, label: "Thu", full: "Thursday" },
  { n: 5, label: "Fri", full: "Friday" },
  { n: 6, label: "Sat", full: "Saturday" },
] as const;

/** Formats a period's window as "8:30 – 9:15" (12h, no leading zero). */
export function formatPeriodTime(period: Pick<Period, "start_time" | "end_time">): string {
  return `${to12h(period.start_time)} – ${to12h(period.end_time)}`;
}

/** "13:15:00" | "13:15" → "1:15". */
function to12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m}`;
}

/** Grid row order: chronological by start time, falling back to position. */
export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.position - b.position
  );
}

/**
 * Indexes entries by `${day}:${periodId}` so a cell can be looked up in O(1)
 * while rendering the grid. One entry per (class, day, period) is guaranteed by
 * the table's unique constraint, so the map is unambiguous per class.
 */
export function indexEntries(entries: TimetableEntry[]): Map<string, TimetableEntry> {
  const map = new Map<string, TimetableEntry>();
  for (const e of entries) map.set(cellKey(e.day_of_week, e.period_id), e);
  return map;
}

export function cellKey(day: number, periodId: string): string {
  return `${day}:${periodId}`;
}

export type Collision = {
  day: number;
  periodId: string;
  teacherId: string;
  /** Every class that has this teacher booked in this day+period. */
  classSectionIds: string[];
};

/**
 * A teacher can only be in one room at a time. A collision is any (day, period,
 * teacher) that appears across more than one class section. Break periods and
 * unassigned (null teacher) cells are ignored. Used both to flag the builder
 * grid and to list conflicts in the principal's collision panel.
 */
export function detectCollisions(entries: TimetableEntry[], periods: Period[]): Collision[] {
  const breakIds = new Set(periods.filter((p) => p.is_break).map((p) => p.id));

  // key: `${day}:${periodId}:${teacherId}` → set of class section ids
  const seen = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.teacher_id || breakIds.has(e.period_id)) continue;
    const key = `${e.day_of_week}:${e.period_id}:${e.teacher_id}`;
    const set = seen.get(key) ?? new Set<string>();
    set.add(e.class_section_id);
    seen.set(key, set);
  }

  const collisions: Collision[] = [];
  for (const [key, classIds] of seen) {
    if (classIds.size < 2) continue;
    const [dayStr, periodId, teacherId] = key.split(":");
    collisions.push({
      day: Number(dayStr),
      periodId,
      teacherId,
      classSectionIds: [...classIds],
    });
  }
  return collisions;
}

/**
 * The set of `${day}:${periodId}` cells for one class that participate in a
 * collision — lets the grid highlight only the offending cells of the class
 * being edited.
 */
export function collidingCellsForClass(
  collisions: Collision[],
  classSectionId: string
): Set<string> {
  const cells = new Set<string>();
  for (const c of collisions) {
    if (c.classSectionIds.includes(classSectionId)) {
      cells.add(cellKey(c.day, c.periodId));
    }
  }
  return cells;
}
