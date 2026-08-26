"use client";

import { useRouter } from "next/navigation";
import { BarList, DonutChart, Legend, type Segment } from "./charts";
import type { ClassAnalytics } from "@/lib/results-analytics";

// Cycling palette for the per-subject failures donut.
const FAIL_PALETTE = ["#f43f5e", "#fb7185", "#f59e0b", "#f97316", "#a855f7", "#6366f1", "#0ea5e9", "#14b8a6"];

const BAND_COLORS: Record<string, string> = {
  "Excellent (90+)": "#10b981",
  "Good (65–89)": "#0ea5e9",
  "Pass (40–64)": "#f59e0b",
  "Fail (<40)": "#f43f5e",
};

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

      {(analytics.failuresBySubject.length > 0 || analytics.bandDistribution.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {analytics.failuresBySubject.length > 0 && (
            <ChartCard title="Failures per subject" caption="Where the class is weakest">
              {(() => {
                const segments: Segment[] = analytics.failuresBySubject.map((f, i) => ({
                  label: f.subject,
                  value: f.failCount,
                  color: FAIL_PALETTE[i % FAIL_PALETTE.length],
                }));
                const total = segments.reduce((s, seg) => s + seg.value, 0);
                return (
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                    <DonutChart segments={segments} centerValue={String(total)} centerLabel="fails" />
                    <div className="w-full max-w-xs">
                      <Legend segments={segments} total={total} />
                    </div>
                  </div>
                );
              })()}
            </ChartCard>
          )}

          {analytics.bandDistribution.length > 0 && (
            <ChartCard title="Marks distribution" caption="Students by performance band">
              {(() => {
                const segments: Segment[] = analytics.bandDistribution.map((b) => ({
                  label: b.label,
                  value: b.count,
                  color: BAND_COLORS[b.label] ?? "#94a3b8",
                }));
                const total = segments.reduce((s, seg) => s + seg.value, 0);
                return (
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                    <DonutChart segments={segments} centerValue={String(total)} centerLabel="students" />
                    <div className="w-full max-w-xs">
                      <Legend segments={segments} total={total} />
                    </div>
                  </div>
                );
              })()}
            </ChartCard>
          )}
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

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-heading text-sm uppercase tracking-wide text-slate">{title}</h3>
      <p className="mb-3 text-xs text-slate">{caption}</p>
      {children}
    </div>
  );
}

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
