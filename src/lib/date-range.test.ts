import { afterEach, describe, expect, it, vi } from "vitest";
import { DATE_RANGE_OPTIONS, rangeFrom } from "./date-range";

const originalTz = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

/** 15:30 IST on Wed 18 Nov 2026 (10:00 UTC). */
function freezeAt(iso: string, tz: string) {
  process.env.TZ = tz;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

// The result must not depend on the server's zone: Vercel runs UTC, the school's
// own hardware will run IST. (Regression: toISOString() used to shift local
// midnight back a day on IST hosts, so "This month" started on the 31st.)
describe.each(["UTC", "Asia/Kolkata", "America/New_York", "Pacific/Auckland"])("rangeFrom on a %s host", (tz) => {
  it("week = 7 days back from today's IST date", () => {
    freezeAt("2026-11-18T10:00:00Z", tz);
    expect(rangeFrom("week")).toBe("2026-11-11");
  });

  it("month = first of the current IST month", () => {
    freezeAt("2026-11-18T10:00:00Z", tz);
    expect(rangeFrom("month")).toBe("2026-11-01");
  });

  it("6months = same day six months back", () => {
    freezeAt("2026-11-18T10:00:00Z", tz);
    expect(rangeFrom("6months")).toBe("2026-05-18");
  });

  it("year = 1 January of the current IST year", () => {
    freezeAt("2026-11-18T10:00:00Z", tz);
    expect(rangeFrom("year")).toBe("2026-01-01");
  });

  it("uses the IST date, not the host's, around midnight", () => {
    // 20:00 UTC on 31 Dec is already 1 Jan 01:30 in IST.
    freezeAt("2026-12-31T20:00:00Z", tz);
    expect(rangeFrom("year")).toBe("2027-01-01");
    expect(rangeFrom("month")).toBe("2027-01-01");
  });
});

describe("rangeFrom edge cases", () => {
  it("all, unknown, empty and nullish values mean no lower bound", () => {
    for (const v of ["all", "forever", "", null, undefined]) expect(rangeFrom(v)).toBeNull();
  });

  it("week crosses a month boundary", () => {
    freezeAt("2026-03-03T10:00:00Z", "Asia/Kolkata");
    expect(rangeFrom("week")).toBe("2026-02-24");
  });

  it("6months clamps correctly across a year boundary", () => {
    freezeAt("2026-02-10T10:00:00Z", "Asia/Kolkata");
    expect(rangeFrom("6months")).toBe("2025-08-10");
  });

  it("every advertised option other than 'all' yields a date", () => {
    freezeAt("2026-11-18T10:00:00Z", "UTC");
    for (const o of DATE_RANGE_OPTIONS) {
      expect(rangeFrom(o.value) === null).toBe(o.value === "all");
    }
  });
});
