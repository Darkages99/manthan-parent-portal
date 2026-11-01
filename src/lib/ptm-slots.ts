// Pure, framework-free PTM helpers — shared by the create-meeting form (client)
// and the createSlots server action, so the default and the generation rule
// can't drift apart.

/** Grades above this get the longer default slot; at/below get the shorter one. */
const SHORT_SLOT_MAX_GRADE = 5;
const SHORT_SLOT_MINUTES = 7;
const LONG_SLOT_MINUTES = 10;

/** Parses the leading integer off a stored grade value (e.g. "5", "5A") so the
 * default slot length can vary by grade. The grade must START with the number:
 * anything else (e.g. "Nursery", "Grade 5") falls back to the longer default. */
export function defaultSlotMinutesForGrade(grade: string): number {
  const n = parseInt(grade, 10);
  if (Number.isNaN(n)) return LONG_SLOT_MINUTES;
  return n <= SHORT_SLOT_MAX_GRADE ? SHORT_SLOT_MINUTES : LONG_SLOT_MINUTES;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHhmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Splits a booking window into back-to-back equal slots: `[start, start+n)`,
 * `[start+n, start+2n)`, … while a whole slot still fits before `end`. Times are
 * `HH:MM` within one day; a trailing remainder shorter than a slot is dropped.
 * Works in plain minutes (no wrap past midnight), so it always terminates.
 */
export function generateSlotWindows(
  start: string,
  end: string,
  slotMinutes: number
): { start: string; end: string }[] {
  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) return [];
  const endMin = toMinutes(end);
  const windows: { start: string; end: string }[] = [];
  for (let cursor = toMinutes(start); cursor + slotMinutes <= endMin; cursor += slotMinutes) {
    windows.push({ start: toHhmm(cursor), end: toHhmm(cursor + slotMinutes) });
  }
  return windows;
}
