import { describe, expect, it } from "vitest";
import { fromISODate, monthGrid, monthLabel, toISODate, weekOf, weekRangeLabel } from "./calendar";

describe("toISODate / fromISODate", () => {
  it("round-trips without timezone drift", () => {
    for (const iso of ["2026-01-01", "2026-03-08", "2026-10-25", "2026-12-31", "2028-02-29"]) {
      expect(toISODate(fromISODate(iso))).toBe(iso);
    }
  });

  it("zero-pads month and day", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("monthLabel", () => {
  it("uses a zero-based month index", () => {
    expect(monthLabel(2026, 0)).toBe("January 2026");
    expect(monthLabel(2026, 11)).toBe("December 2026");
  });
});

describe("monthGrid", () => {
  const today = new Date(2026, 10, 18); // Wed 18 Nov 2026

  it("weeks start on Monday and have seven days", () => {
    const grid = monthGrid(2026, 10, today); // Nov 2026: 1 Nov is a Sunday
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].iso).toBe("2026-10-26"); // Monday before
    expect(grid[0][6].iso).toBe("2026-11-01");
    for (const week of grid) expect(week[0].date.getDay()).toBe(1);
  });

  it("flags in-month days, weekends and today", () => {
    const days = monthGrid(2026, 10, today).flat();
    expect(days.filter((d) => d.inMonth)).toHaveLength(30);
    expect(days.find((d) => d.iso === "2026-10-26")?.inMonth).toBe(false);
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual(["2026-11-18"]);
    expect(days.find((d) => d.iso === "2026-11-14")?.isWeekend).toBe(true); // Saturday
    expect(days.find((d) => d.iso === "2026-11-16")?.isWeekend).toBe(false);
  });

  it("covers every day of the month exactly once, in order", () => {
    for (const [y, m, n] of [[2026, 1, 28], [2028, 1, 29], [2026, 11, 31], [2026, 4, 31]] as const) {
      const inMonth = monthGrid(y, m, today).flat().filter((d) => d.inMonth);
      expect(inMonth).toHaveLength(n);
      expect(inMonth.map((d) => d.date.getDate())).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  it("uses 4–6 rows depending on how the month falls against Monday", () => {
    expect(monthGrid(2027, 1, today)).toHaveLength(4); // Feb 2027: 28 days starting on a Monday
    expect(monthGrid(2026, 1, today)).toHaveLength(5); // Feb 2026: starts on a Sunday
    expect(monthGrid(2026, 7, today)).toHaveLength(6); // Aug 2026: 31 days starting on a Saturday
  });
});

describe("weekOf", () => {
  it("returns Monday → Sunday around the reference date", () => {
    const days = weekOf(new Date(2026, 10, 18), new Date(2026, 10, 18));
    expect(days.map((d) => d.iso)).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual(["2026-11-18"]);
    expect(days.filter((d) => d.isWeekend).map((d) => d.iso)).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("a Sunday belongs to the week that started the previous Monday", () => {
    expect(weekOf(new Date(2026, 10, 22))[0].iso).toBe("2026-11-16");
  });

  it("crosses month and year boundaries", () => {
    expect(weekOf(new Date(2027, 0, 1)).map((d) => d.iso)).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });
});

describe("weekRangeLabel", () => {
  it("collapses the month when the week stays inside one", () => {
    expect(weekRangeLabel(weekOf(new Date(2026, 10, 18)))).toBe("16 – 22 Nov 2026");
  });

  it("shows both months when the week straddles two", () => {
    expect(weekRangeLabel(weekOf(new Date(2026, 9, 29)))).toBe("26 Oct – 1 Nov 2026");
  });
});
