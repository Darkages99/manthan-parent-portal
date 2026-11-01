import { describe, expect, it } from "vitest";
import {
  FAIL_THRESHOLD_PCT,
  WEAK_THRESHOLD_PCT,
  computeClassAnalytics,
  computeStudentAnalytics,
  distinctTerms,
} from "./results-analytics";

type R = Parameters<typeof computeStudentAnalytics>[0][number];
const r = (student_id: string, term: string, subject: string, marks: number, max_marks = 100): R => ({
  student_id,
  term,
  subject,
  marks,
  max_marks,
});

describe("thresholds", () => {
  it("are the documented school values", () => {
    expect(FAIL_THRESHOLD_PCT).toBe(40);
    expect(WEAK_THRESHOLD_PCT).toBe(65);
  });
});

describe("distinctTerms", () => {
  it("de-duplicates and sorts lexically descending", () => {
    expect(distinctTerms([{ term: "Term 1" }, { term: "Term 2" }, { term: "Term 1" }, { term: "Annual" }])).toEqual([
      "Term 2",
      "Term 1",
      "Annual",
    ]);
  });
  it("is empty for no results", () => {
    expect(distinctTerms([])).toEqual([]);
  });
});

describe("computeStudentAnalytics", () => {
  it("handles a student with no marks", () => {
    expect(computeStudentAnalytics([])).toEqual({
      latestTerm: null,
      latestAveragePct: null,
      overallAveragePct: 0,
      termAverages: [],
      bestSubject: null,
      weakestSubject: null,
      failingSubjects: [],
      centumCount: 0,
      trend: null,
      trendDelta: null,
    });
  });

  it("ignores entries with a zero or negative maximum (no divide-by-zero)", () => {
    const a = computeStudentAnalytics([r("s", "Term 1", "Maths", 10, 0), r("s", "Term 1", "Sci", 60)]);
    expect(a.overallAveragePct).toBe(60);
    expect(a.termAverages).toEqual([{ term: "Term 1", percentage: 60, subjectCount: 1 }]);
  });

  describe("across two terms", () => {
    const a = computeStudentAnalytics([
      r("s", "Term 1", "Maths", 50),
      r("s", "Term 1", "Sci", 70),
      r("s", "Term 2", "Maths", 80),
      r("s", "Term 2", "Sci", 60),
    ]);

    it("reports newest term first with per-term averages", () => {
      expect(a.latestTerm).toBe("Term 2");
      expect(a.latestAveragePct).toBe(70);
      expect(a.termAverages.map((t) => [t.term, t.percentage])).toEqual([["Term 2", 70], ["Term 1", 60]]);
    });

    it("overall average spans every entry", () => {
      expect(a.overallAveragePct).toBe(65);
    });

    it("picks best and weakest subject from the latest term only", () => {
      expect(a.bestSubject?.subject).toBe("Maths");
      expect(a.weakestSubject?.subject).toBe("Sci");
    });

    it("trend is up by the term-over-term delta", () => {
      expect(a.trend).toBe("up");
      expect(a.trendDelta).toBe(10);
    });
  });

  it("trend needs two terms, and is 'flat' within ±0.5 points", () => {
    expect(computeStudentAnalytics([r("s", "Term 1", "M", 50)]).trend).toBeNull();
    const t = (second: number) =>
      computeStudentAnalytics([r("s", "Term 1", "M", 50), r("s", "Term 2", "M", second)]).trend;
    expect(t(50.5)).toBe("flat"); // exactly +0.5 is still flat
    expect(t(49.5)).toBe("flat");
    expect(t(50.6)).toBe("up");
    expect(t(49.4)).toBe("down");
  });

  it("failing subjects are strictly below 40% in the latest term", () => {
    const a = computeStudentAnalytics([
      r("s", "Term 2", "Maths", 39),
      r("s", "Term 2", "Sci", 40),
      r("s", "Term 1", "Hindi", 10), // older term, not counted
    ]);
    expect(a.failingSubjects.map((s) => s.subject)).toEqual(["Maths"]);
  });

  it("counts full marks (centum) in the latest term only", () => {
    const a = computeStudentAnalytics([
      r("s", "Term 2", "Maths", 100),
      r("s", "Term 2", "Sci", 50, 50),
      r("s", "Term 2", "Eng", 99),
      r("s", "Term 1", "Maths", 100),
    ]);
    expect(a.centumCount).toBe(2);
  });

  it("works on non-100 maxima by using percentages", () => {
    const a = computeStudentAnalytics([r("s", "Term 1", "Maths", 18, 20), r("s", "Term 1", "Sci", 45, 50)]);
    expect(a.latestAveragePct).toBe(90);
  });
});

describe("computeClassAnalytics", () => {
  const students = ["A", "B", "C", "D", "E"].map((id) => ({ id, first_name: `First${id}`, last_name: `Last${id}` }));
  const results = [
    r("A", "Term 1", "Maths", 100), r("A", "Term 1", "Sci", 90), //  95 → excellent, 1 centum
    r("B", "Term 1", "Maths", 70), r("B", "Term 1", "Sci", 60), //   65 → good (boundary)
    r("C", "Term 1", "Maths", 40), r("C", "Term 1", "Sci", 50), //   45 → pass, 40% is not a fail
    r("D", "Term 1", "Maths", 30), r("D", "Term 1", "Sci", 20), //   25 → fail, two failing entries
    r("E", "Term 1", "Maths", 35), r("E", "Term 1", "Sci", 90), //   62.5 → pass, one failing entry
    r("A", "Term 2", "Maths", 10), //                                other term: must not leak in
    r("A", "Term 1", "Art", 5, 0), //                                zero max: ignored
  ];
  const c = computeClassAnalytics(results, students, "Term 1");

  it("lists available terms across all results", () => {
    expect(c.termsAvailable).toEqual(["Term 2", "Term 1"]);
  });

  it("class average is the mean of per-student averages", () => {
    expect(c.studentCount).toBe(5);
    expect(c.classAveragePct).toBe(58.5);
  });

  it("pass rate counts students under 40% average as failing", () => {
    expect(c.belowFortyCount).toBe(1);
    expect(c.passRatePct).toBe(80);
    expect(c.atRisk.map((s) => s.studentId)).toEqual(["D"]);
  });

  it("identifies the top performer and excellence/centum counts", () => {
    expect(c.topPerformer).toMatchObject({ studentId: "A", name: "FirstA LastA", percentage: 95 });
    expect(c.excellenceCount).toBe(1);
    expect(c.centumCount).toBe(1);
  });

  it("subject averages are sorted high → low with strongest/weakest at the ends", () => {
    expect(c.subjectAverages.map((s) => [s.subject, s.percentage])).toEqual([["Sci", 62], ["Maths", 55]]);
    expect(c.strongestSubject?.subject).toBe("Sci");
    expect(c.weakestSubject?.subject).toBe("Maths");
  });

  it("counts failing entries per subject and students with any failing entry", () => {
    expect(c.failuresBySubject).toEqual([
      { subject: "Maths", failCount: 2 },
      { subject: "Sci", failCount: 1 },
    ]);
    expect(c.singleSubjectFailCount).toBe(2);
  });

  it("distributes students into bands with inclusive lower edges", () => {
    expect(c.bandDistribution).toEqual([
      { label: "Excellent (90+)", count: 1 },
      { label: "Good (65–89)", count: 1 },
      { label: "Pass (40–64)", count: 2 },
      { label: "Fail (<40)", count: 1 },
    ]);
  });

  it("drops empty bands", () => {
    const only = computeClassAnalytics([r("A", "T", "M", 95)], students, "T");
    expect(only.bandDistribution).toEqual([{ label: "Excellent (90+)", count: 1 }]);
  });

  it("falls back to a placeholder name for a student not on the roster", () => {
    const x = computeClassAnalytics([r("ghost", "T", "M", 80)], students, "T");
    expect(x.topPerformer?.name).toBe("Unknown student");
  });

  it("is all zeros/nulls for a term with no marks", () => {
    const e = computeClassAnalytics(results, students, "Term 9");
    expect(e).toMatchObject({
      studentCount: 0,
      classAveragePct: 0,
      passRatePct: 0,
      topPerformer: null,
      weakestSubject: null,
      strongestSubject: null,
      bandDistribution: [],
      atRisk: [],
    });
  });
});
