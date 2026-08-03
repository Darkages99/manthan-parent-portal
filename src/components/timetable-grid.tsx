import { DAYS, formatPeriodTime, sortPeriods, type Period } from "@/lib/timetable";

/** One rendered cell: a subject/primary line and an optional secondary line
 *  (teacher for a class view, or class for a teacher's own schedule). */
export type GridCell = {
  primary: string;
  secondary?: string;
  /** Draws the cell in a collision (conflict) style. */
  conflict?: boolean;
};

/**
 * Read-only timetable. Dumb and fully serializable: the caller precomputes a
 * `cells` map keyed by `${day}:${periodId}` (see `cellKey`), so this renders
 * identically for the parent view, a teacher's own schedule, and a class view.
 *
 * `mode: "week"` (default) renders the full Mon–Sat grid. `mode: "day"` renders
 * a single day as a scannable vertical list — easier to digest on a small screen.
 */
export function TimetableGrid({
  periods,
  cells,
  emptyLabel = "No timetable published yet.",
  mode = "week",
  day,
}: {
  periods: Period[];
  cells: Record<string, GridCell | undefined>;
  emptyLabel?: string;
  mode?: "week" | "day";
  /** Required when mode is "day" — the DAYS[].n to show. */
  day?: number;
}) {
  const ordered = sortPeriods(periods);
  if (ordered.length === 0) {
    return <p className="text-base text-slate">{emptyLabel}</p>;
  }

  if (mode === "day") {
    return (
      <div className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        {ordered.map((p) =>
          p.is_break ? (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-mist/60 px-4 py-2.5">
              <span className="text-sm font-medium uppercase tracking-wide text-slate">{p.label}</span>
              <span className="text-xs tabular-nums text-slate">{formatPeriodTime(p)}</span>
            </div>
          ) : (
            <div key={p.id} className="flex items-start gap-4 px-4 py-3">
              <div className="w-20 shrink-0">
                <p className="text-sm font-semibold text-slate-strong">{p.label}</p>
                <p className="text-xs tabular-nums text-slate">{formatPeriodTime(p)}</p>
              </div>
              {(() => {
                const cell = cells[`${day}:${p.id}`];
                return cell ? (
                  <div
                    className={`min-w-0 flex-1 rounded-sm border px-3 py-2 ${
                      cell.conflict
                        ? "border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-900/20"
                        : "border-hairline bg-mist/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-maroon">{cell.primary}</p>
                    {cell.secondary && <p className="text-xs text-slate-strong">{cell.secondary}</p>}
                    {cell.conflict && (
                      <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-rose-600">
                        Clash
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="min-h-[2.25rem] flex-1 rounded-sm border border-dashed border-hairline/70" />
                );
              })()}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="bg-maroon text-cream">
          <tr>
            <th className="px-3 py-3 font-heading text-sm font-normal">Time</th>
            {DAYS.map((d) => (
              <th key={d.n} className="px-3 py-3 text-center font-heading text-sm font-normal">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {ordered.map((p) =>
            p.is_break ? (
              <tr key={p.id} className="bg-mist/60">
                <td className="px-3 py-2 text-xs tabular-nums text-slate">
                  {formatPeriodTime(p)}
                </td>
                <td
                  colSpan={DAYS.length}
                  className="px-3 py-2 text-center text-sm font-medium uppercase tracking-wide text-slate"
                >
                  {p.label}
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-3 py-2 align-top">
                  <p className="text-sm font-semibold text-slate-strong">{p.label}</p>
                  <p className="text-xs tabular-nums text-slate">{formatPeriodTime(p)}</p>
                </td>
                {DAYS.map((d) => {
                  const cell = cells[`${d.n}:${p.id}`];
                  return (
                    <td key={d.n} className="px-2 py-2 align-top">
                      {cell ? (
                        <div
                          className={`rounded-sm border px-2 py-1.5 ${
                            cell.conflict
                              ? "border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-900/20"
                              : "border-hairline bg-mist/40"
                          }`}
                        >
                          <p className="text-sm font-semibold text-maroon">{cell.primary}</p>
                          {cell.secondary && (
                            <p className="truncate text-xs text-slate-strong">{cell.secondary}</p>
                          )}
                          {cell.conflict && (
                            <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-rose-600">
                              Clash
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="min-h-[2.25rem] rounded-sm border border-dashed border-hairline/70" />
                      )}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
