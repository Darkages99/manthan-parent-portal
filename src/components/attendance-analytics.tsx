"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AttendanceMarker } from "./attendance-marker";
import { AlertTriangleIcon, CheckCircleIcon, ChevronDownIcon, ChevronRightIcon } from "./icons";
import { DonutChart, Legend, type Segment } from "./charts";
import { ComboBox } from "./combobox";
import { ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type Student = Tables<"students">;
type AttendanceRecord = Tables<"attendance_records">;
type Status = Enums<"attendance_status">;
/** Per-student term aggregate from the attendance_summary RPC. */
type AttendanceSummary = { student_id: string; total: number; present_pct: number };

const STATUS_META: Record<Status, { label: string; color: string }> = {
  present: { label: "Present", color: "#10b981" },
  absent: { label: "Absent", color: "#f43f5e" },
  late: { label: "Late", color: "#f59e0b" },
  half_day: { label: "Half day", color: "#94a3b8" },
};

export function AttendanceAnalytics({
  classes,
  students,
  todayRecords,
  summaries,
  approvedTodayStudentIds,
  today,
  initialClassId,
  initialMarkOpen,
}: {
  classes: ClassSection[];
  students: Student[];
  /** Attendance rows for `today` only — drives the snapshot and absent list. */
  todayRecords: AttendanceRecord[];
  /** DB-aggregated term percentages, one per student — drives below-threshold. */
  summaries: AttendanceSummary[];
  /** Students with an approved leave covering today (→ "informed" absence). */
  approvedTodayStudentIds: string[];
  today: string;
  /** Preselects a class (e.g. arriving from a "Mark manually" link) and, when
   * paired with initialMarkOpen, jumps straight into the marking form. */
  initialClassId?: string;
  initialMarkOpen?: boolean;
}) {
  const [classFilter, setClassFilter] = useState<string>(initialClassId ?? "all");
  const [markOpen, setMarkOpen] = useState(Boolean(initialMarkOpen));
  // Today's rows just saved by AttendanceMarker, merged in immediately rather
  // than waiting on the server round trip that repopulates `todayRecords` —
  // keeps the "Today" snapshot in sync with the save the instant it succeeds.
  const [justSaved, setJustSaved] = useState<AttendanceRecord[]>([]);

  const effectiveTodayRecords = useMemo(() => {
    if (justSaved.length === 0) return todayRecords;
    const byStudent = new Map(todayRecords.map((r) => [r.student_id, r]));
    for (const r of justSaved) byStudent.set(r.student_id, r);
    return [...byStudent.values()];
  }, [todayRecords, justSaved]);

  function onAttendanceSaved(date: string, entries: { studentId: string; status: Status }[]) {
    // Only today's save affects the on-page snapshot; past-date edits are
    // reflected on the next refresh (router.refresh runs after every save).
    if (date !== today) return;
    setJustSaved((prev) => [
      ...prev,
      ...entries.map((e) => ({
        id: `optimistic-${e.studentId}-${date}`,
        student_id: e.studentId,
        date,
        status: e.status,
        marked_by: null,
      })),
    ]);
  }

  const classLabel = (id: string) => {
    const c = classes.find((cs) => cs.id === id);
    return c ? `Grade ${c.grade}-${c.section}` : "";
  };
  const approvedToday = useMemo(
    () => new Set(approvedTodayStudentIds),
    [approvedTodayStudentIds]
  );

  const inScope = (student: Student) =>
    classFilter === "all" || student.class_section_id === classFilter;
  const scopedStudents = students.filter(inScope);
  const scopedIds = new Set(scopedStudents.map((s) => s.id));

  // --- Today snapshot ---
  const todayByStudent = new Map<string, Status>();
  for (const r of effectiveTodayRecords) {
    if (scopedIds.has(r.student_id)) todayByStudent.set(r.student_id, r.status);
  }
  const todayCounts: Record<Status, number> = { present: 0, absent: 0, late: 0, half_day: 0 };
  for (const status of todayByStudent.values()) todayCounts[status] += 1;
  const markedToday = todayByStudent.size;
  const notMarked = scopedStudents.length - markedToday;
  // Present % is of the whole roster, not just those marked — 30 present out of
  // 60 students is 50% present, not 100%.
  const presentPct =
    scopedStudents.length > 0 ? Math.round((todayCounts.present / scopedStudents.length) * 100) : 0;
  const todaySegments: Segment[] = (["present", "absent", "late", "half_day"] as Status[]).map((k) => ({
    label: STATUS_META[k].label,
    value: todayCounts[k],
    color: STATUS_META[k].color,
  }));
  if (notMarked > 0) {
    todaySegments.push({ label: "Not marked", value: notMarked, color: "#cbd5e1" });
  }

  // --- Absent today, split informed / uninformed ---
  const absentToday = scopedStudents
    .filter((s) => todayByStudent.get(s.id) === "absent")
    .map((s) => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      className: classLabel(s.class_section_id),
      informed: approvedToday.has(s.id),
    }));
  const uninformedCount = absentToday.filter((a) => !a.informed).length;

  // --- Below threshold (term) — from the DB aggregate, one row per student ---
  const summaryByStudent = new Map(summaries.map((s) => [s.student_id, s]));
  const belowThreshold = scopedStudents
    .map((s) => {
      const summary = summaryByStudent.get(s.id);
      return {
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        className: classLabel(s.class_section_id),
        pct: summary && summary.total > 0 ? summary.present_pct : null,
      };
    })
    .filter((s): s is { id: string; name: string; className: string; pct: number } => s.pct !== null && s.pct < ATTENDANCE_THRESHOLD)
    .sort((a, b) => a.pct - b.pct);

  const studentsByClass: Record<string, Student[]> = {};
  for (const c of classes) studentsByClass[c.id] = [];
  for (const s of students) studentsByClass[s.class_section_id]?.push(s);

  return (
    <div className="flex flex-col gap-6">
      {classes.length > 1 && (
        <label className="flex w-64 flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Class</span>
          <ComboBox
            options={[
              { value: "all", label: "All classes" },
              ...classes.map((c) => ({
                value: c.id,
                label: `Grade ${c.grade} - ${c.section}`,
              })),
            ]}
            value={classFilter}
            onChange={setClassFilter}
            required
            placeholder="Search class…"
            ariaLabel="Class"
            recallKey="attendance-analytics-class"
          />
        </label>
      )}

      {/* Today snapshot */}
      <Link
        href="/console/attendance/classes"
        className="block rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] transition hover:border-rust/60"
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-xl text-maroon">Today</h2>
          <span className="flex items-center gap-1 text-sm text-slate">
            {markedToday} of {scopedStudents.length} marked
            {notMarked > 0 && ` · ${notMarked} not yet marked`}
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </div>
        {markedToday === 0 ? (
          <p className="py-6 text-center text-base text-slate">
            Attendance hasn&apos;t been marked yet today.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <DonutChart
              segments={todaySegments}
              centerValue={`${presentPct}%`}
              centerLabel="present"
            />
            <div className="w-full max-w-xs">
              <Legend segments={todaySegments} total={scopedStudents.length} />
            </div>
          </div>
        )}
        <p className="mt-4 text-sm font-medium text-rust">See every class →</p>
      </Link>

      {/* Absent today */}
      <section className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-xl text-maroon">Absent today</h2>
          {uninformedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
              <AlertTriangleIcon className="h-4 w-4" />
              {uninformedCount} uninformed
            </span>
          )}
        </div>
        {absentToday.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-slate-strong">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            No absences recorded today.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {absentToday.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-base text-slate-strong">
                  {a.name}
                  {a.className && <span className="ml-2 text-sm text-slate">{a.className}</span>}
                </span>
                {a.informed ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                    Informed
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-sm font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                    Uninformed
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Below threshold */}
      <section className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 font-heading text-xl text-maroon">
          Below {ATTENDANCE_THRESHOLD}% attendance
        </h2>
        {belowThreshold.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-slate-strong">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            Every student is at or above the {ATTENDANCE_THRESHOLD}% minimum.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {belowThreshold.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-base text-slate-strong">
                  {s.name}
                  {s.className && <span className="ml-2 text-sm text-slate">{s.className}</span>}
                </span>
                <span className="font-heading text-lg text-rose-600 dark:text-rose-300">{s.pct}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Marking — available but secondary. */}
      <section className="rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <button
          type="button"
          onClick={() => setMarkOpen((o) => !o)}
          aria-expanded={markOpen}
          className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
        >
          <span>
            <span className="font-heading text-xl text-maroon">Mark attendance</span>
            <span className="ml-2 text-sm text-slate">Set each student&apos;s status for the day</span>
          </span>
          <ChevronDownIcon
            className={`h-5 w-5 shrink-0 text-slate transition-transform ${markOpen ? "" : "-rotate-90"}`}
          />
        </button>
        {markOpen && (
          <div className="border-t border-hairline p-6">
            {classes.length === 0 ? (
              <p className="text-base text-slate">No class is assigned to you for marking.</p>
            ) : (
              <AttendanceMarker
                classes={classes}
                studentsByClass={studentsByClass}
                todayRecords={effectiveTodayRecords}
                today={today}
                initialClassId={initialClassId}
                onSaved={onAttendanceSaved}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
