"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { TimetableGrid, type GridCell } from "./timetable-grid";
import { DAYS, type Period } from "@/lib/timetable";
import { useSelectedChild } from "@/lib/selected-child-context";

type Child = { id: string; first_name: string; last_name: string; classSectionId: string | null };

/** Today's DAYS[].n (Mon=1..Sat=6), falling back to Monday on a Sunday. */
function todayDayNumber(): number {
  const jsDay = new Date().getDay(); // Sun=0..Sat=6
  return jsDay === 0 ? 1 : jsDay;
}

/**
 * Parent-facing timetable: switch between children and see each one's class
 * timetable, either as a single scannable day or the full week grid. Cells
 * are precomputed per class on the server.
 */
export function ParentTimetable({
  students,
  periods,
  cellsByClass,
}: {
  students: Child[];
  periods: Period[];
  cellsByClass: Record<string, Record<string, GridCell>>;
}) {
  const { selectedChildId } = useSelectedChild();
  const activeId = selectedChildId ?? students[0]?.id ?? "";
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState(todayDayNumber());
  const active = students.find((s) => s.id === activeId) ?? students[0];
  const cells = (active?.classSectionId && cellsByClass[active.classSectionId]) || {};
  const activeDay = DAYS.find((d) => d.n === day) ?? DAYS[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-sm border border-hairline bg-surface p-0.5">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-sm px-4 py-1.5 text-sm font-medium capitalize transition ${
                view === v ? "bg-maroon text-cream" : "text-slate-strong hover:text-maroon"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {view === "day" && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDay((d) => (d === 1 ? 6 : d - 1))}
              aria-label="Previous day"
              className="rounded-full border border-hairline bg-surface p-1.5 text-slate shadow-[var(--shadow-card)] transition hover:bg-mist hover:text-maroon"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="min-w-24 rounded-full border border-hairline bg-surface px-3 py-1 text-center text-base font-semibold text-maroon shadow-[var(--shadow-card)]">
              {activeDay.full}
            </span>
            <button
              type="button"
              onClick={() => setDay((d) => (d === 6 ? 1 : d + 1))}
              aria-label="Next day"
              className="rounded-full border border-hairline bg-surface p-1.5 text-slate shadow-[var(--shadow-card)] transition hover:bg-mist hover:text-maroon"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <TimetableGrid
        periods={periods}
        cells={cells}
        emptyLabel="No timetable has been published for this class yet."
        mode={view}
        day={day}
      />
    </div>
  );
}
