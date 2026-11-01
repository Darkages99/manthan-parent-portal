import { describe, expect, it } from "vitest";
import { defaultSlotMinutesForGrade, generateSlotWindows } from "./ptm-slots";

describe("defaultSlotMinutesForGrade", () => {
  it("grades 5 and below get 7-minute slots", () => {
    for (const g of ["1", "3", "5", "5A", "05"]) expect(defaultSlotMinutesForGrade(g)).toBe(7);
  });

  it("grades above 5 get 10-minute slots", () => {
    for (const g of ["6", "8", "12", "9B"]) expect(defaultSlotMinutesForGrade(g)).toBe(10);
  });

  it("falls back to the longer slot unless the value starts with a number", () => {
    for (const g of ["", "Nursery", "KG", "LKG-A", "Grade 5"]) expect(defaultSlotMinutesForGrade(g)).toBe(10);
  });
});

describe("generateSlotWindows", () => {
  it("tiles the window with back-to-back slots", () => {
    expect(generateSlotWindows("09:00", "09:45", 15)).toEqual([
      { start: "09:00", end: "09:15" },
      { start: "09:15", end: "09:30" },
      { start: "09:30", end: "09:45" },
    ]);
  });

  it("drops a trailing remainder shorter than a slot", () => {
    const w = generateSlotWindows("09:00", "09:50", 15);
    expect(w).toHaveLength(3);
    expect(w[2].end).toBe("09:45");
  });

  it("a window exactly one slot long yields one slot; shorter yields none", () => {
    expect(generateSlotWindows("10:00", "10:07", 7)).toHaveLength(1);
    expect(generateSlotWindows("10:00", "10:06", 7)).toEqual([]);
  });

  it("handles the default 2-hour window at both default slot lengths", () => {
    expect(generateSlotWindows("09:00", "11:00", 10)).toHaveLength(12);
    const sevens = generateSlotWindows("09:00", "11:00", 7);
    expect(sevens).toHaveLength(17); // 17 × 7 = 119 min; the last 1 minute is dropped
    expect(sevens[16].end).toBe("10:59");
  });

  it("crosses the hour and pads times", () => {
    expect(generateSlotWindows("08:50", "09:20", 15)).toEqual([
      { start: "08:50", end: "09:05" },
      { start: "09:05", end: "09:20" },
    ]);
  });

  it("an empty or inverted window yields nothing", () => {
    expect(generateSlotWindows("09:00", "09:00", 15)).toEqual([]);
    expect(generateSlotWindows("11:00", "09:00", 15)).toEqual([]);
  });

  it("terminates for a window running to the end of the day (regression: wrapped past midnight and never ended)", () => {
    const w = generateSlotWindows("23:00", "23:59", 15);
    expect(w).toHaveLength(3);
    expect(w[2]).toEqual({ start: "23:30", end: "23:45" });
  });

  it("rejects a non-positive or fractional slot length instead of looping", () => {
    for (const n of [0, -5, 7.5, Number.NaN]) expect(generateSlotWindows("09:00", "10:00", n)).toEqual([]);
  });
});
