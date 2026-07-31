/**
 * Date-grid helpers shared by every calendar surface (dashboard, attendance
 * register, dates-to-remember). Weeks run Monday → Sunday, the convention used
 * across Indian school calendars. All ISO strings are LOCAL `yyyy-mm-dd`, so
 * they line up with the date-only columns stored in Postgres without any
 * timezone drift.
 */

export type CalendarDay = {
  date: Date;
  /** Local calendar date as `yyyy-mm-dd`. */
  iso: string;
  /** Belongs to the month being displayed (vs. leading/trailing spill days). */
  inMonth: boolean;
  isToday: boolean;
  /** Saturday or Sunday. */
  isWeekend: boolean;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Local `yyyy-mm-dd` for a Date, avoiding `toISOString()`'s UTC shift. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a `yyyy-mm-dd` string into a local Date (no timezone surprises). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Days from Monday, i.e. Mon=0 … Sun=6. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** Build the 6×7 (or fewer) week rows covering the given month. */
export function monthGrid(year: number, month: number, today = new Date()): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - mondayIndex(first));

  const todayIso = toISODate(today);
  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);

  // Enough rows to cover the whole month (5 or 6), stopping once we pass it.
  for (let w = 0; w < 6; w++) {
    const row: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = toISODate(cursor);
      const dow = cursor.getDay();
      row.push({
        date: new Date(cursor),
        iso,
        inMonth: cursor.getMonth() === month,
        isToday: iso === todayIso,
        isWeekend: dow === 0 || dow === 6,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
    // Stop after we've rendered the last day of the month.
    if (cursor.getMonth() !== month && cursor > first) break;
  }
  return weeks;
}

/** The seven days (Mon→Sun) of the week containing `ref`. */
export function weekOf(ref: Date, today = new Date()): CalendarDay[] {
  const start = new Date(ref);
  start.setDate(ref.getDate() - mondayIndex(ref));
  const todayIso = toISODate(today);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay();
    days.push({
      date,
      iso: toISODate(date),
      inMonth: true,
      isToday: toISODate(date) === todayIso,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

/** "5 – 11 Aug 2026" style label for a week range. */
export function weekRangeLabel(days: CalendarDay[]): string {
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const sameMonth = first.getMonth() === last.getMonth();
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const left = first.toLocaleDateString("en-IN", sameMonth ? { day: "numeric" } : opts);
  const right = last.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${right}`;
}
