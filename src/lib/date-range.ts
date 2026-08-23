// Pure helper — computes the earliest date (YYYY-MM-DD, IST) a "range" filter
// should include. Shared between list pages and their CSV export routes.
export const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "year", label: "This year" },
  { value: "6months", label: "Last 6 months" },
  { value: "month", label: "This month" },
  { value: "week", label: "This week" },
] as const;

export type DateRange = (typeof DATE_RANGE_OPTIONS)[number]["value"];

function istToday(): Date {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Date(`${iso}T00:00:00`);
}

/** Returns the inclusive lower bound (YYYY-MM-DD) for a range, or null for "all". */
export function rangeFrom(range: string | null | undefined): string | null {
  const today = istToday();
  switch (range) {
    case "week": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    }
    case "month":
      return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    case "6months": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      return d.toISOString().slice(0, 10);
    }
    case "year":
      return new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    default:
      return null;
  }
}
