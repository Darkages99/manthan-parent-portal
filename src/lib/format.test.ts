import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatDayDate,
  formatRupees,
  formatSlotTime,
  formatTime,
} from "./format";

// Locale output differs slightly between ICU versions ("AM" vs "am"), so the
// meridiem is matched case-insensitively; everything else is exact.
const meridiem = (s: string) => s.replace(/\s?(am|pm)$/i, (m) => m.toUpperCase().replace(/^\s?/, " "));

describe("formatTime", () => {
  it("trims Postgres time to HH:MM", () => {
    expect(formatTime("15:30:00")).toBe("15:30");
    expect(formatTime("08:05")).toBe("08:05");
  });
});

describe("formatDate / formatDayDate", () => {
  it("formats a date-only string", () => {
    expect(formatDate("2026-07-30")).toBe("30 Jul 2026");
    expect(formatDate("2026-01-05")).toBe("05 Jan 2026");
  });

  it("includes the weekday in the short form", () => {
    expect(formatDayDate("2026-07-30")).toBe("Thu, 30 Jul");
  });
});

describe("IST timestamp formatters", () => {
  // 04:00 UTC = 09:30 IST
  const iso = "2026-08-08T04:00:00Z";

  it("formatSlotTime renders in IST regardless of host zone", () => {
    expect(meridiem(formatSlotTime(iso))).toBe("8 Aug, 9:30 AM");
  });

  it("formatDateTime adds the year", () => {
    expect(meridiem(formatDateTime(iso))).toBe("8 Aug 2026, 9:30 AM");
  });

  it("formatClock is just the time", () => {
    expect(meridiem(formatClock(iso))).toBe("9:30 AM");
  });

  it("rolls the IST date forward past UTC midnight", () => {
    expect(formatSlotTime("2026-08-08T20:00:00Z")).toMatch(/^9 Aug, 1:30/);
  });
});

describe("formatRupees", () => {
  it("converts paise to whole rupees with Indian grouping", () => {
    expect(formatRupees(1_250_000)).toBe("₹12,500");
    expect(formatRupees(12_345_600)).toBe("₹1,23,456");
    expect(formatRupees(0)).toBe("₹0");
  });
});
