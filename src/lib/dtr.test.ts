import { describe, expect, it } from "vitest";
import { DTR_CATEGORIES, categoryChip, categoryDot, categoryLabel } from "./dtr";

describe("DTR categories", () => {
  it("every category has a label, chip style and dot colour", () => {
    expect(DTR_CATEGORIES).toHaveLength(6);
    for (const c of DTR_CATEGORIES) {
      expect(categoryLabel[c]).toBeTruthy();
      expect(categoryChip[c]).toBeTruthy();
      expect(categoryDot[c]).toBeTruthy();
    }
  });

  it("the lookup tables have no stray keys", () => {
    for (const table of [categoryLabel, categoryChip, categoryDot]) {
      expect(Object.keys(table).sort()).toEqual([...DTR_CATEGORIES].sort());
    }
  });

  it("categories are unique", () => {
    expect(new Set(DTR_CATEGORIES).size).toBe(DTR_CATEGORIES.length);
  });
});
