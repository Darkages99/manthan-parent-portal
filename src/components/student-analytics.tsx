import type { StudentAnalytics } from "@/lib/results-analytics";

/** One student's performance snapshot: latest-term average, trend vs. the
 *  previous term, and their best/weakest subjects. Sits above the marks editor. */
export function StudentAnalyticsPanel({ analytics }: { analytics: StudentAnalytics }) {
  if (!analytics.latestTerm) {
    return (
      <div className="rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-sm text-slate">
        No marks entered for this student yet — add the first one below.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-maroon">Student performance</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={`${analytics.latestTerm} average`} value={`${analytics.latestAveragePct!.toFixed(1)}%`} />
        <StatTile label="Overall average" value={`${analytics.overallAveragePct.toFixed(1)}%`} />
        <StatTile
          label="Trend vs. last term"
          value={
            analytics.trend === "up"
              ? `▲ +${analytics.trendDelta!.toFixed(1)}%`
              : analytics.trend === "down"
                ? `▼ ${analytics.trendDelta!.toFixed(1)}%`
                : analytics.trend === "flat"
                  ? "Steady"
                  : "—"
          }
          tone={analytics.trend === "up" ? "good" : analytics.trend === "down" ? "warn" : undefined}
        />
        <StatTile
          label="Centums this term"
          value={String(analytics.centumCount)}
          tone={analytics.centumCount > 0 ? "good" : undefined}
        />
      </div>

      {(analytics.bestSubject || analytics.weakestSubject) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {analytics.bestSubject && (
            <InfoCard
              label="Strongest subject"
              value={analytics.bestSubject.subject}
              detail={`${analytics.bestSubject.percentage.toFixed(1)}% this term`}
            />
          )}
          {analytics.weakestSubject && (
            <InfoCard
              label="Needs attention"
              value={analytics.weakestSubject.subject}
              detail={`${analytics.weakestSubject.percentage.toFixed(1)}% this term`}
              tone={analytics.weakestSubject.percentage < 40 ? "warn" : undefined}
            />
          )}
        </div>
      )}

      {analytics.failingSubjects.length > 0 && (
        <div className="rounded-sm border border-rose-400 bg-rose-50/70 p-4 dark:border-rose-500/50 dark:bg-rose-900/20">
          <h3 className="font-heading text-lg text-rose-700 dark:text-rose-200">
            Below 40% in {analytics.failingSubjects.length}{" "}
            {analytics.failingSubjects.length === 1 ? "subject" : "subjects"} this term
          </h3>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {analytics.failingSubjects.map((s) => (
              <li key={s.subject} className="text-sm text-slate-strong">
                <span className="font-semibold text-maroon">{s.subject}</span> —{" "}
                {s.percentage.toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
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
      <p className={`mt-1 font-heading text-lg ${tone === "warn" ? "text-rose-600 dark:text-rose-300" : "text-maroon"}`}>
        {value}
      </p>
      <p className="text-xs text-slate">{detail}</p>
    </div>
  );
}
