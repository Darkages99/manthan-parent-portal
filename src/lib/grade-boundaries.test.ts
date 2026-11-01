import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSubjectGradingConfig, gradeForPercentage, type GradeBand } from "./grade-boundaries";

const BANDS: GradeBand[] = [
  { grade: "A", minPct: 80, maxPct: 100 },
  { grade: "B", minPct: 60, maxPct: 79.99 },
  { grade: "C", minPct: 40, maxPct: 59.99 },
];

describe("gradeForPercentage", () => {
  it("picks the band containing the percentage, inclusive at both ends", () => {
    expect(gradeForPercentage(100, BANDS)).toBe("A");
    expect(gradeForPercentage(80, BANDS)).toBe("A");
    expect(gradeForPercentage(79.99, BANDS)).toBe("B");
    expect(gradeForPercentage(40, BANDS)).toBe("C");
  });

  it("returns null when nothing matches (gaps are valid teacher config)", () => {
    expect(gradeForPercentage(39.9, BANDS)).toBeNull();
    expect(gradeForPercentage(79.995, BANDS)).toBeNull();
    expect(gradeForPercentage(50, [])).toBeNull();
  });

  it("prefers the highest-minPct band when bands overlap", () => {
    const overlapping: GradeBand[] = [
      { grade: "B", minPct: 50, maxPct: 90 },
      { grade: "A", minPct: 75, maxPct: 100 },
    ];
    expect(gradeForPercentage(80, overlapping)).toBe("A");
    expect(gradeForPercentage(60, overlapping)).toBe("B");
  });

  it("does not reorder the caller's array", () => {
    const copy = BANDS.map((b) => ({ ...b }));
    gradeForPercentage(70, BANDS);
    expect(BANDS).toEqual(copy);
  });
});

describe("getSubjectGradingConfig", () => {
  function fake(config: { max_marks: number } | null, boundaries: unknown[] | null) {
    const calls: { table: string; filters: Record<string, string> }[] = [];
    const client = {
      from: (table: string) => {
        const rec = { table, filters: {} as Record<string, string> };
        calls.push(rec);
        const q = {
          select: () => q,
          eq: (col: string, val: string) => {
            rec.filters[col] = val;
            return q;
          },
          order: async () => ({ data: boundaries }),
          maybeSingle: async () => ({ data: config }),
        };
        return q;
      },
    } as unknown as SupabaseClient<Database>;
    return { client, calls };
  }

  it("maps rows to bands and uses the configured max marks", async () => {
    const { client, calls } = fake({ max_marks: 50 }, [{ grade: "A", min_pct: 80, max_pct: 100 }]);
    const cfg = await getSubjectGradingConfig(client, "Maths", "Term 1");
    expect(cfg).toEqual({ maxMarks: 50, bands: [{ grade: "A", minPct: 80, maxPct: 100 }] });
    expect(calls.map((c) => c.table).sort()).toEqual(["grade_boundaries", "subject_grading_config"]);
    for (const c of calls) expect(c.filters).toEqual({ subject: "Maths", term: "Term 1" });
  });

  it("defaults to 100 max marks and no bands when never configured", async () => {
    const { client } = fake(null, null);
    expect(await getSubjectGradingConfig(client, "Art", "Annual")).toEqual({ maxMarks: 100, bands: [] });
  });
});
