/** Postgres `time` columns come back as "15:30:00" — trim to "15:30". */
export function formatTime(t: string): string {
  return t.slice(0, 5);
}

/** "2026-07-30" → "30 Jul 2026". Accepts date or ISO strings. */
export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "2026-07-30" → "Thu, 30 Jul". */
export function formatDayDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

/** A timestamptz → "8 Aug, 9:30 AM" in IST. */
export function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/** A timestamptz → "8 Aug 2026, 9:30 AM" in IST — full date+time for audit trails. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/** Just the clock part of a timestamptz in IST → "9:30 AM". */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/** paise (bigint) → "₹12,500". */
export function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
