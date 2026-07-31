"use client";

import { useState } from "react";
import { ChildTabs } from "./child-tabs";
import { AttendanceCalendar } from "./attendance-calendar";
import { AlertTriangleIcon } from "./icons";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type Student = Tables<"students">;
type AttendanceRecord = Tables<"attendance_records">;
type Status = Enums<"attendance_status">;

const ATTENDANCE_THRESHOLD = 85;

const STATUS_META: Record<Status, { label: string; solid: string }> = {
  present: { label: "Present", solid: "#10b981" },
  late: { label: "Late", solid: "#f59e0b" },
  excused: { label: "Excused", solid: "#94a3b8" },
  absent: { label: "Absent", solid: "#f43f5e" },
};

/** SVG donut summarising the term's attendance mix. */
function AttendanceDonut({ counts, total, pct }: { counts: Record<Status, number>; total: number; pct: number }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const order: Status[] = ["present", "late", "excused", "absent"];

  let acc = 0;
  const segments = order.map((s) => {
    const frac = total ? counts[s] / total : 0;
    const seg = { s, frac, offset: acc };
    acc += frac;
    return seg;
  });

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-hairline)" strokeWidth="12" />
        {total > 0 &&
          segments.map(
            (seg) =>
              seg.frac > 0 && (
                <circle
                  key={seg.s}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={STATUS_META[seg.s].solid}
                  strokeWidth="12"
                  strokeDasharray={`${seg.frac * C} ${C - seg.frac * C}`}
                  transform={`rotate(${seg.offset * 360 - 90} 50 50)`}
                />
              )
          )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl text-maroon">{pct}%</span>
        <span className="text-xs uppercase tracking-wide text-slate">present</span>
      </div>
    </div>
  );
}

export function AttendanceView({
  students,
  recordsByStudent,
}: {
  students: Student[];
  recordsByStudent: Record<string, AttendanceRecord[]>;
}) {
  const [activeId, setActiveId] = useState(students[0]?.id);
  const records = recordsByStudent[activeId] ?? [];

  const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of records) counts[r.status] += 1;
  const total = records.length;
  const presentPct = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
  const belowThreshold = total > 0 && presentPct < ATTENDANCE_THRESHOLD;

  const statusByDate: Record<string, Status> = {};
  for (const r of records) statusByDate[r.date] = r.status;

  return (
    <div className="flex flex-col gap-6">
      <ChildTabs students={students} activeId={activeId} onSelect={setActiveId} />

      {/* Summary card: donut + breakdown, with a low-attendance alert. */}
      <div
        className={`relative rounded-sm border bg-surface p-6 shadow-[var(--shadow-card)] ${
          belowThreshold ? "border-rose-400 dark:border-rose-500/60" : "border-hairline"
        }`}
      >
        {belowThreshold && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
            <AlertTriangleIcon className="h-4 w-4" />
            Below {ATTENDANCE_THRESHOLD}%
          </div>
        )}

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <AttendanceDonut counts={counts} total={total} pct={presentPct} />

          <div className="flex-1">
            <p className="mb-3 text-sm uppercase tracking-wide text-slate">Attendance this term</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["present", "absent", "late", "excused"] as Status[]).map((k) => (
                <div key={k}>
                  <p className="font-heading text-3xl text-maroon">{counts[k]}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm uppercase tracking-wide text-slate">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_META[k].solid }}
                    />
                    {STATUS_META[k].label}
                  </p>
                </div>
              ))}
            </div>
            {belowThreshold && (
              <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">
                Attendance has fallen below the {ATTENDANCE_THRESHOLD}% requirement. Please reach out to the
                class teacher.
              </p>
            )}
          </div>
        </div>
      </div>

      <AttendanceCalendar statusByDate={statusByDate} />
    </div>
  );
}
