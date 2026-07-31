"use client";

import { useMemo, useState } from "react";
import { monthGrid, monthLabel, WEEKDAY_LABELS } from "@/lib/calendar";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import type { Enums } from "@/lib/supabase/database.types";

type Status = Enums<"attendance_status">;

const STATUS_FILL: Record<Status, string> = {
  present: "bg-emerald-500 text-white",
  absent: "bg-rose-500 text-white",
  late: "bg-amber-500 text-white",
  excused: "bg-slate-400 text-white",
};

const STATUS_LABEL: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

/** Month-grid view of a single child's daily attendance register. */
export function AttendanceCalendar({ statusByDate }: { statusByDate: Record<string, Status> }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month, today), [cursor, today]);

  function step(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-xl text-maroon">Daily register</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="rounded-sm p-1.5 text-slate-strong transition hover:bg-mist hover:text-maroon"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="min-w-[9rem] text-center font-heading text-lg text-maroon">
            {monthLabel(cursor.year, cursor.month)}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next month"
            className="rounded-sm p-1.5 text-slate-strong transition hover:bg-mist hover:text-maroon"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate">
              {d}
            </div>
          ))}
          {weeks.flat().map((day) => {
            const status = statusByDate[day.iso];
            return (
              <div
                key={day.iso}
                className="flex aspect-square items-center justify-center"
                title={status ? `${STATUS_LABEL[status]} — ${day.iso}` : undefined}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    status
                      ? `font-semibold ${STATUS_FILL[status]}`
                      : day.inMonth
                        ? "text-slate-strong"
                        : "text-slate/40"
                  } ${day.isToday && !status ? "ring-1 ring-rust" : ""}`}
                >
                  {day.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend. */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-3">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-sm text-slate">
              <span className={`h-3 w-3 rounded-full ${STATUS_FILL[s].split(" ")[0]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
