import { fromISODate, toISODate } from "@/lib/calendar";

// Pure helper — computes the earliest date (YYYY-MM-DD, IST) a "range" filter
// should include. Shared between list pages and their CSV export routes.
// Dates are built and formatted in the host's local zone (never via
// toISOString(), which shifts to UTC), so the result is the same whether the
// server runs in UTC (Vercel) or IST (school hardware).
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
  return fromISODate(iso);
}

/** Returns the inclusive lower bound (YYYY-MM-DD) for a range, or null for "all". */
export function rangeFrom(range: string | null | undefined): string | null {
  const today = istToday();
  switch (range) {
    case "week": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return toISODate(d);
    }
    case "month":
      return toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    case "6months": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      return toISODate(d);
    }
    case "year":
      return toISODate(new Date(today.getFullYear(), 0, 1));
    default:
      return null;
  }
}
