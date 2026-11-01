import { describe, expect, it } from "vitest";
import { ATTENDANCE_THRESHOLD, isBelowThreshold, presentPercent } from "./attendance";

const recs = (...s: ("present" | "absent" | "late" | "half_day")[]) => s.map((status) => ({ status }));

describe("presentPercent", () => {
  it("is 0 for no records (not NaN)", () => {
    expect(presentPercent([])).toBe(0);
  });

  it("present and late count fully; absent counts nothing", () => {
    expect(presentPercent(recs("present", "late", "absent", "absent"))).toBe(50);
    expect(presentPercent(recs("present", "present"))).toBe(100);
    expect(presentPercent(recs("absent"))).toBe(0);
  });

  it("a half day counts as half a present day", () => {
    expect(presentPercent(recs("half_day", "half_day"))).toBe(50);
    expect(presentPercent(recs("present", "half_day"))).toBe(75);
  });

  it("rounds to a whole percent", () => {
    expect(presentPercent(recs("present", "absent", "absent"))).toBe(33);
    expect(presentPercent(recs("present", "present", "absent"))).toBe(67);
  });
});

describe("isBelowThreshold", () => {
  it("is strict: exactly the minimum is fine", () => {
    expect(ATTENDANCE_THRESHOLD).toBe(85);
    expect(isBelowThreshold(84)).toBe(true);
    expect(isBelowThreshold(85)).toBe(false);
    expect(isBelowThreshold(100)).toBe(false);
  });
});
