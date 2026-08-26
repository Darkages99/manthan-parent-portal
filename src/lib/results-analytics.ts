import type { Tables } from "@/lib/supabase/database.types";

type ExamResult = Pick<
  Tables<"exam_results">,
  "student_id" | "term" | "subject" | "marks" | "max_marks"
>;
type StudentLite = { id: string; first_name: string; last_name: string };

export const FAIL_THRESHOLD_PCT = 40;
const EXCELLENCE_THRESHOLD_PCT = 90;
/** A class (or a subject within a class) averaging below this is "weak" —
 * triggers the principal alert in console/results/actions.ts. */
export const WEAK_THRESHOLD_PCT = 65;

export type StudentAverage = {
  studentId: string;
  name: string;
  percentage: number;
  subjectCount: number;
};

export type SubjectAverage = {
  subject: string;
  percentage: number;
  entryCount: number;
};

export type ClassAnalytics = {
  termsAvailable: string[];
  studentCount: number;
  classAveragePct: number;
  passRatePct: number;
  belowFortyCount: number;
  centumCount: number;
  excellenceCount: number;
  topPerformer: StudentAverage | null;
  atRisk: StudentAverage[];
  subjectAverages: SubjectAverage[];
  weakestSubject: SubjectAverage | null;
  strongestSubject: SubjectAverage | null;
  singleSubjectFailCount: number;
  /** Number of failing entries (< 40%) per subject — where the school is weak. */
  failuresBySubject: { subject: string; failCount: number }[];
  /** Students grouped into performance bands, for a distribution donut. */
  bandDistribution: { label: string; count: number }[];
};

/** All distinct terms present in a result set, most recent-looking first (lexical desc). */
export function distinctTerms(results: Pick<ExamResult, "term">[]): string[] {
  return [...new Set(results.map((r) => r.term))].sort().reverse();
}

export type TermAverage = {
  term: string;
  percentage: number;
  subjectCount: number;
};

export type StudentAnalytics = {
  latestTerm: string | null;
  latestAveragePct: number | null;
  overallAveragePct: number;
  termAverages: TermAverage[];
  bestSubject: SubjectAverage | null;
  weakestSubject: SubjectAverage | null;
  failingSubjects: SubjectAverage[];
  centumCount: number;
  trend: "up" | "down" | "flat" | null;
  trendDelta: number | null;
};

/**
 * Computes one student's performance across every term they have marks for —
 * latest-term snapshot, term-over-term trend, and subject strengths/weaknesses.
 */
export function computeStudentAnalytics(results: ExamResult[]): StudentAnalytics {
  const scored = results.filter((r) => r.max_marks > 0);
  const terms = distinctTerms(scored); // newest first

  const byTerm = new Map<string, { pctSum: number; count: number }>();
  for (const r of scored) {
    const pct = (r.marks / r.max_marks) * 100;
    const agg = byTerm.get(r.term) ?? { pctSum: 0, count: 0 };
    agg.pctSum += pct;
    agg.count += 1;
    byTerm.set(r.term, agg);
  }
  const termAverages: TermAverage[] = terms.map((term) => {
    const agg = byTerm.get(term)!;
    return { term, percentage: agg.pctSum / agg.count, subjectCount: agg.count };
  });

  const latestTerm = terms[0] ?? null;
  const latestAveragePct = latestTerm ? byTerm.get(latestTerm)!.pctSum / byTerm.get(latestTerm)!.count : null;
  const overallAveragePct = scored.length
    ? scored.reduce((sum, r) => sum + (r.marks / r.max_marks) * 100, 0) / scored.length
    : 0;

  // Subject performance within the latest term (most actionable for the principal).
  const latestTermResults = latestTerm ? scored.filter((r) => r.term === latestTerm) : [];
  const bySubject = new Map<string, { pctSum: number; count: number }>();
  for (const r of latestTermResults) {
    const pct = (r.marks / r.max_marks) * 100;
    const agg = bySubject.get(r.subject) ?? { pctSum: 0, count: 0 };
    agg.pctSum += pct;
    agg.count += 1;
    bySubject.set(r.subject, agg);
  }
  const subjectAverages: SubjectAverage[] = [...bySubject.entries()]
    .map(([subject, agg]) => ({ subject, percentage: agg.pctSum / agg.count, entryCount: agg.count }))
    .sort((a, b) => b.percentage - a.percentage);

  const centumCount = latestTermResults.filter((r) => r.marks === r.max_marks).length;

  let trend: StudentAnalytics["trend"] = null;
  let trendDelta: number | null = null;
  if (termAverages.length >= 2) {
    trendDelta = termAverages[0].percentage - termAverages[1].percentage;
    trend = trendDelta > 0.5 ? "up" : trendDelta < -0.5 ? "down" : "flat";
  }

  return {
    latestTerm,
    latestAveragePct,
    overallAveragePct,
    termAverages,
    bestSubject: subjectAverages[0] ?? null,
    weakestSubject: subjectAverages[subjectAverages.length - 1] ?? null,
    failingSubjects: subjectAverages.filter((s) => s.percentage < FAIL_THRESHOLD_PCT),
    centumCount,
    trend,
    trendDelta,
  };
}

/**
 * Computes class-level performance stats for one term, for a principal's console.
 * Percentages are per-student averages across their entered subjects for that term.
 */
export function computeClassAnalytics(
  results: ExamResult[],
  students: StudentLite[],
  term: string
): ClassAnalytics {
  const termsAvailable = distinctTerms(results);
  const termResults = results.filter((r) => r.term === term);
  const nameById = new Map(students.map((s) => [s.id, `${s.first_name} ${s.last_name}`]));

  // Per-student aggregation.
  const byStudent = new Map<string, { pctSum: number; count: number; failCount: number }>();
  for (const r of termResults) {
    if (r.max_marks <= 0) continue;
    const pct = (r.marks / r.max_marks) * 100;
    const agg = byStudent.get(r.student_id) ?? { pctSum: 0, count: 0, failCount: 0 };
    agg.pctSum += pct;
    agg.count += 1;
    if (pct < FAIL_THRESHOLD_PCT) agg.failCount += 1;
    byStudent.set(r.student_id, agg);
  }

  const studentAverages: StudentAverage[] = [...byStudent.entries()].map(([studentId, agg]) => ({
    studentId,
    name: nameById.get(studentId) ?? "Unknown student",
    percentage: agg.pctSum / agg.count,
    subjectCount: agg.count,
  }));
  studentAverages.sort((a, b) => b.percentage - a.percentage);

  const belowForty = studentAverages.filter((s) => s.percentage < FAIL_THRESHOLD_PCT);
  const excellence = studentAverages.filter((s) => s.percentage >= EXCELLENCE_THRESHOLD_PCT);
  const centumCount = termResults.filter((r) => r.max_marks > 0 && r.marks === r.max_marks).length;
  const singleSubjectFailCount = [...byStudent.values()].filter((a) => a.failCount > 0).length;

  const classAveragePct = studentAverages.length
    ? studentAverages.reduce((sum, s) => sum + s.percentage, 0) / studentAverages.length
    : 0;
  const passRatePct = studentAverages.length
    ? ((studentAverages.length - belowForty.length) / studentAverages.length) * 100
    : 0;

  // Per-subject aggregation (average + failure count).
  const bySubject = new Map<string, { pctSum: number; count: number; failCount: number }>();
  for (const r of termResults) {
    if (r.max_marks <= 0) continue;
    const pct = (r.marks / r.max_marks) * 100;
    const agg = bySubject.get(r.subject) ?? { pctSum: 0, count: 0, failCount: 0 };
    agg.pctSum += pct;
    agg.count += 1;
    if (pct < FAIL_THRESHOLD_PCT) agg.failCount += 1;
    bySubject.set(r.subject, agg);
  }
  const subjectAverages: SubjectAverage[] = [...bySubject.entries()]
    .map(([subject, agg]) => ({ subject, percentage: agg.pctSum / agg.count, entryCount: agg.count }))
    .sort((a, b) => b.percentage - a.percentage);
  const failuresBySubject = [...bySubject.entries()]
    .map(([subject, agg]) => ({ subject, failCount: agg.failCount }))
    .filter((f) => f.failCount > 0)
    .sort((a, b) => b.failCount - a.failCount);

  // Performance bands across students (for a distribution donut).
  const bandDistribution = [
    { label: "Excellent (90+)", count: studentAverages.filter((s) => s.percentage >= 90).length },
    {
      label: "Good (65–89)",
      count: studentAverages.filter((s) => s.percentage >= 65 && s.percentage < 90).length,
    },
    {
      label: "Pass (40–64)",
      count: studentAverages.filter((s) => s.percentage >= FAIL_THRESHOLD_PCT && s.percentage < 65).length,
    },
    { label: "Fail (<40)", count: belowForty.length },
  ].filter((b) => b.count > 0);

  return {
    termsAvailable,
    studentCount: studentAverages.length,
    classAveragePct,
    passRatePct,
    belowFortyCount: belowForty.length,
    centumCount,
    excellenceCount: excellence.length,
    topPerformer: studentAverages[0] ?? null,
    atRisk: belowForty,
    subjectAverages,
    weakestSubject: subjectAverages[subjectAverages.length - 1] ?? null,
    strongestSubject: subjectAverages[0] ?? null,
    singleSubjectFailCount,
    failuresBySubject,
    bandDistribution,
  };
}
