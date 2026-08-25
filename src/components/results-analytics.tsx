"use client";

import { useRouter } from "next/navigation";
import { BarList } from "./charts";
import type { ClassAnalytics } from "@/lib/results-analytics";

/** Class-wide performance dashboard for the principal: pass rate, spread, and
 *  who/what needs attention this term. Sits above the per-student editor. */
export function ResultsAnalytics({
  analytics,
  classId,
  term,
}: {
  analytics: ClassAnalytics;
  classId: string;
  term: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl text-maroon">Class performance</h2>
        {analytics.termsAvailable.length > 1 && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-strong">
            Term
            <select
              value={term}
              onChange={(e) =>
                router.push(`/console/results?class=${classId}&term=${e.target.value}`)
              }
              className="rounded-sm border border-hairline bg-mist px-2 py-1.5 text-sm text-slate-strong"
            >
              {analytics.termsAvailable.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Class average" value={`${analytics.classAveragePct.toFixed(1)}%`} />
        <StatTile label="Pass rate" value={`${analytics.passRatePct.toFixed(0)}%`} />
        <StatTile
          label="Below 40%"
          value={String(analytics.belowFortyCount)}
          tone={analytics.belowFortyCount > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Centums"
          value={String(analytics.centumCount)}
          tone={analytics.centumCount > 0 ? "good" : undefined}
        />
        <StatTile label="90%+ scorers" value={String(analytics.excellenceCount)} />
        <StatTile
          label="Failed ≥1 subject"
          value={String(analytics.singleSubjectFailCount)}
          tone={analytics.singleSubjectFailCount > 0 ? "warn" : "good"}
        />
      </div>

      {(analytics.topPerformer || analytics.weakestSubject || analytics.strongestSubject) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {analytics.topPerformer && (
            <InfoCard
              label="Top performer"
              value={analytics.topPerformer.name}
              detail={`${analytics.topPerformer.percentage.toFixed(1)}% average`}
            />
          )}
          {analytics.strongestSubject && (
            <InfoCard
              label="Strongest subject"
              value={analytics.strongestSubject.subject}
              detail={`${analytics.strongestSubject.percentage.toFixed(1)}% class average`}
            />
          )}
          {analytics.weakestSubject && (
            <InfoCard
              label="Needs attention"
              value={analytics.weakestSubject.subject}
              detail={`${analytics.weakestSubject.percentage.toFixed(1)}% class average`}
              tone="warn"
            />
          )}
        </div>
      )}

      {analytics.subjectAverages.length > 1 && (
        <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 font-heading text-sm uppercase tracking-wide text-slate">
            Subject-wise average
          </h3>
          <BarList
            percent
            labelWidth="9rem"
            items={analytics.subjectAverages.map((s) => ({
              label: s.subject,
              value: s.percentage,
              display: `${s.percentage.toFixed(1)}%`,
              color: s.percentage < FAIL_BAR_PCT ? "#f43f5e" : "var(--color-rust)",
            }))}
          />
        </div>
      )}

      {analytics.atRisk.length > 0 && (
        <div className="rounded-sm border border-rose-400 bg-rose-50/70 p-4 dark:border-rose-500/50 dark:bg-rose-900/20">
          <h3 className="font-heading text-lg text-rose-700 dark:text-rose-200">
            {analytics.atRisk.length} {analytics.atRisk.length === 1 ? "student" : "students"} below
            40% average
          </h3>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {analytics.atRisk.map((s) => (
              <li key={s.studentId} className="text-sm text-slate-strong">
                <span className="font-semibold text-maroon">{s.name}</span> —{" "}
                {s.percentage.toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const FAIL_BAR_PCT = 40;

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
      <p
        className={`mt-1 font-heading text-2xl ${
          tone === "warn"
            ? "text-rose-600 dark:text-rose-300"
            : tone === "good"
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-maroon"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
      <p
        className={`mt-1 font-heading text-lg ${
          tone === "warn" ? "text-rose-600 dark:text-rose-300" : "text-maroon"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate">{detail}</p>
    </div>
  );
}
