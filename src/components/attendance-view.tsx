"use client";

import { AttendanceCalendar } from "./attendance-calendar";
import { AlertTriangleIcon } from "./icons";
import { DonutChart, type Segment } from "./charts";
import { ATTENDANCE_THRESHOLD, presentPercent } from "@/lib/attendance";
import { useSelectedChild } from "@/lib/selected-child-context";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type Student = Tables<"students">;
type AttendanceRecord = Tables<"attendance_records">;
type Status = Enums<"attendance_status">;

const STATUS_META: Record<Status, { label: string; solid: string }> = {
  present: { label: "Present", solid: "#10b981" },
  late: { label: "Late", solid: "#f59e0b" },
  half_day: { label: "Half day", solid: "#94a3b8" },
  absent: { label: "Absent", solid: "#f43f5e" },
};

export function AttendanceView({
  students,
  recordsByStudent,
}: {
  students: Student[];
  recordsByStudent: Record<string, AttendanceRecord[]>;
}) {
  const { selectedChildId } = useSelectedChild();
  const activeId = selectedChildId ?? students[0]?.id;
  const records = recordsByStudent[activeId] ?? [];

  const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, half_day: 0 };
  for (const r of records) counts[r.status] += 1;
  const total = records.length;
  const presentPct = presentPercent(records);
  const belowThreshold = total > 0 && presentPct < ATTENDANCE_THRESHOLD;

  const statusByDate: Record<string, Status> = {};
  for (const r of records) statusByDate[r.date] = r.status;

  const donutSegments: Segment[] = (["present", "late", "half_day", "absent"] as Status[]).map((k) => ({
    label: STATUS_META[k].label,
    value: counts[k],
    color: STATUS_META[k].solid,
  }));

  return (
    <div className="flex flex-col gap-6">
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
          <DonutChart
            segments={donutSegments}
            size={160}
            thickness={16}
            centerValue={`${presentPct}%`}
            centerLabel="present"
          />

          <div className="flex-1">
            <p className="mb-3 text-sm uppercase tracking-wide text-slate">Attendance this term</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["present", "absent", "late", "half_day"] as Status[]).map((k) => (
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
