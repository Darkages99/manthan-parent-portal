import Link from "next/link";
import { WEAK_THRESHOLD_PCT } from "@/lib/results-analytics";

export type ClassSummary = {
  id: string;
  label: string;
  studentCount: number;
  classAveragePct: number;
  passRatePct: number;
  belowFortyCount: number;
  weakestSubject: { subject: string; percentage: number } | null;
};

/**
 * Whole-scope results overview shown when no class is selected — "whole
 * school" for a principal/coordinator, "my classes" for a teacher who takes
 * more than one. Mirrors the attendance "Today" snapshot: KPI tiles plus a
 * link into the class-wise card drill-down at /console/results/classes.
 */
export function ResultsSchoolOverview({
  scopeLabel,
  term,
  classes,
}: {
  scopeLabel: string;
  term: string | null;
  classes: ClassSummary[];
}) {
  if (classes.length === 0 || !term) {
    return (
      <p className="rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-sm text-slate">
        No marks entered yet — pick a class below to add some.
      </p>
    );
  }

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const overallAveragePct = totalStudents
    ? classes.reduce((sum, c) => sum + c.classAveragePct * c.studentCount, 0) / totalStudents
    : 0;
  const overallPassRatePct = totalStudents
    ? classes.reduce((sum, c) => sum + c.passRatePct * c.studentCount, 0) / totalStudents
    : 0;
  const totalBelowForty = classes.reduce((sum, c) => sum + c.belowFortyCount, 0);
  const weakClasses = classes
    .filter((c) => c.classAveragePct < WEAK_THRESHOLD_PCT)
    .sort((a, b) => a.classAveragePct - b.classAveragePct);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-heading text-xl text-maroon">
          {scopeLabel} — {term}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-sm border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-wide text-slate">Average</p>
          <p className="mt-1 font-heading text-2xl text-maroon">{overallAveragePct.toFixed(1)}%</p>
        </div>
        <div className="rounded-sm border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-wide text-slate">Pass rate</p>
          <p className="mt-1 font-heading text-2xl text-maroon">{overallPassRatePct.toFixed(0)}%</p>
        </div>
        <div className="rounded-sm border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-wide text-slate">Below 40% (any subject)</p>
          <p
            className={`mt-1 font-heading text-2xl ${totalBelowForty > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}
          >
            {totalBelowForty}
          </p>
        </div>
        <div className="rounded-sm border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-wide text-slate">Weak classes (&lt;{WEAK_THRESHOLD_PCT}%)</p>
          <p
            className={`mt-1 font-heading text-2xl ${weakClasses.length > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}
          >
            {weakClasses.length}
          </p>
        </div>
      </div>

      {weakClasses.length > 0 && (
        <div className="rounded-sm border border-rose-400 bg-rose-50/70 p-4 dark:border-rose-500/50 dark:bg-rose-900/20">
          <h3 className="font-heading text-lg text-rose-700 dark:text-rose-200">Needs attention</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {weakClasses.map((c) => (
              <li key={c.id} className="text-sm text-slate-strong">
                <span className="font-semibold text-maroon">{c.label}</span> — {c.classAveragePct.toFixed(1)}%
                average
                {c.weakestSubject && ` · weakest: ${c.weakestSubject.subject} (${c.weakestSubject.percentage.toFixed(1)}%)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/console/results/classes"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-rust hover:underline"
      >
        See every class →
      </Link>
    </div>
  );
}
