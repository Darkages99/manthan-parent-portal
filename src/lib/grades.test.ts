import { describe, expect, it } from "vitest";
import { GRADE_OPTIONS, TERM_OPTIONS, withCurrentValue } from "./grades";

describe("withCurrentValue", () => {
  it("returns the list unchanged when the current value is already in it", () => {
    expect(withCurrentValue(GRADE_OPTIONS, "B+")).toBe(GRADE_OPTIONS);
  });

  it("prepends a legacy value so editing never drops it", () => {
    expect(withCurrentValue(TERM_OPTIONS, "Mid-Term")[0]).toBe("Mid-Term");
    expect(withCurrentValue(TERM_OPTIONS, "Mid-Term")).toHaveLength(TERM_OPTIONS.length + 1);
  });

  it("ignores an empty current value", () => {
    expect(withCurrentValue(GRADE_OPTIONS, "")).toBe(GRADE_OPTIONS);
  });

  it("does not mutate the input list", () => {
    const opts = ["A", "B"];
    withCurrentValue(opts, "Z");
    expect(opts).toEqual(["A", "B"]);
  });
});
