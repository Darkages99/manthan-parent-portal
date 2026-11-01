import { describe, expect, it } from "vitest";
import {
  DAYS,
  cellKey,
  collidingCellsForClass,
  detectCollisions,
  formatPeriodTime,
  indexEntries,
  sortPeriods,
  type Period,
  type TimetableEntry,
} from "./timetable";

const period = (id: string, start: string, position: number, is_break = false): Period =>
  ({ id, start_time: start, end_time: "00:00", position, is_break }) as unknown as Period;

const entry = (day: number, periodId: string, classId: string, teacherId: string | null): TimetableEntry =>
  ({
    day_of_week: day,
    period_id: periodId,
    class_section_id: classId,
    teacher_id: teacherId,
  }) as unknown as TimetableEntry;

describe("DAYS", () => {
  it("is Monday–Saturday numbered 1–6", () => {
    expect(DAYS.map((d) => d.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(DAYS[0].full).toBe("Monday");
    expect(DAYS[5].full).toBe("Saturday");
  });
});

describe("formatPeriodTime", () => {
  it("renders 12-hour times without a leading zero or meridiem", () => {
    expect(formatPeriodTime({ start_time: "08:30:00", end_time: "09:15:00" })).toBe("8:30 – 9:15");
    expect(formatPeriodTime({ start_time: "13:15", end_time: "14:00" })).toBe("1:15 – 2:00");
  });

  it("maps midnight and noon to 12", () => {
    expect(formatPeriodTime({ start_time: "00:05", end_time: "12:00" })).toBe("12:05 – 12:00");
  });
});

describe("sortPeriods", () => {
  it("orders by start time, breaking ties by position, without mutating", () => {
    const input = [period("c", "10:00", 3), period("a", "08:30", 2), period("b", "08:30", 1)];
    expect(sortPeriods(input).map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(input.map((p) => p.id)).toEqual(["c", "a", "b"]);
  });
});

describe("indexEntries / cellKey", () => {
  it("keys each entry by day:period", () => {
    const e = entry(2, "p1", "c1", "t1");
    const map = indexEntries([e]);
    expect(map.get(cellKey(2, "p1"))).toBe(e);
    expect(map.get(cellKey(3, "p1"))).toBeUndefined();
  });
});

describe("detectCollisions", () => {
  const periods = [period("p1", "08:30", 1), period("p2", "09:15", 2), period("brk", "10:00", 3, true)];

  it("flags a teacher booked in two classes in the same day+period", () => {
    const entries = [entry(1, "p1", "c1", "t1"), entry(1, "p1", "c2", "t1"), entry(1, "p1", "c3", "t2")];
    const found = detectCollisions(entries, periods);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ day: 1, periodId: "p1", teacherId: "t1" });
    expect([...found[0].classSectionIds].sort()).toEqual(["c1", "c2"]);
  });

  it("does not flag the same teacher on a different day or period", () => {
    const entries = [entry(1, "p1", "c1", "t1"), entry(2, "p1", "c2", "t1"), entry(1, "p2", "c3", "t1")];
    expect(detectCollisions(entries, periods)).toEqual([]);
  });

  it("ignores break periods and unassigned cells", () => {
    const entries = [
      entry(1, "brk", "c1", "t1"),
      entry(1, "brk", "c2", "t1"),
      entry(1, "p1", "c1", null),
      entry(1, "p1", "c2", null),
    ];
    expect(detectCollisions(entries, periods)).toEqual([]);
  });

  it("one class listing the same teacher twice is not a collision", () => {
    expect(detectCollisions([entry(1, "p1", "c1", "t1"), entry(1, "p1", "c1", "t1")], periods)).toEqual([]);
  });
});

describe("collidingCellsForClass", () => {
  it("returns only the cells where the given class is involved", () => {
    const periods = [period("p1", "08:30", 1), period("p2", "09:15", 2)];
    const entries = [
      entry(1, "p1", "c1", "t1"),
      entry(1, "p1", "c2", "t1"),
      entry(2, "p2", "c2", "t2"),
      entry(2, "p2", "c3", "t2"),
    ];
    const collisions = detectCollisions(entries, periods);
    expect([...collidingCellsForClass(collisions, "c1")]).toEqual(["1:p1"]);
    expect([...collidingCellsForClass(collisions, "c2")].sort()).toEqual(["1:p1", "2:p2"]);
    expect(collidingCellsForClass(collisions, "c9").size).toBe(0);
  });
});
