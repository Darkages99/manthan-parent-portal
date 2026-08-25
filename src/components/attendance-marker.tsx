"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAttendanceForDate, saveAttendance } from "@/app/(staff)/console/attendance/actions";
import { useToast } from "./toast-provider";
import { ComboBox } from "./combobox";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type Student = Tables<"students">;
type AttendanceRecord = Tables<"attendance_records">;

const STATUSES: { value: Enums<"attendance_status">; label: string; active: string }[] = [
  { value: "present", label: "P", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "absent", label: "A", active: "bg-rose-600 text-white border-rose-600" },
  { value: "late", label: "L", active: "bg-amber-500 text-white border-amber-500" },
  { value: "half_day", label: "H", active: "bg-slate-500 text-white border-slate-500" },
];

export function AttendanceMarker({
  classes,
  studentsByClass,
  todayRecords,
  today,
  initialClassId,
  onSaved,
}: {
  classes: ClassSection[];
  studentsByClass: Record<string, Student[]>;
  /** Today's records, used as the baseline seed when the (default) date is
   * today — avoids a fetch flash on open. Other dates are loaded on demand. */
  todayRecords: AttendanceRecord[];
  /** Today's IST calendar date (YYYY-MM-DD). Computed on the server so it
   * matches how records are stored; the max selectable date. */
  today: string;
  initialClassId?: string;
  /** Called with the just-saved entries so a parent holding its own snapshot
   * (e.g. the "Today" counts) can update immediately, without waiting on a
   * server round trip. */
  onSaved?: (date: string, entries: { studentId: string; status: Enums<"attendance_status"> }[]) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [classId, setClassId] = useState(
    (initialClassId && classes.some((c) => c.id === initialClassId) ? initialClassId : classes[0]?.id) ?? ""
  );
  const [date, setDate] = useState(today);
  const [overrides, setOverrides] = useState<Record<string, Enums<"attendance_status">>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const students = useMemo(() => studentsByClass[classId] ?? [], [studentsByClass, classId]);
  const classStudentIds = useMemo(() => students.map((s) => s.id), [students]);

  // Baseline of what's already saved for the selected class + date. Today (the
  // default) is derived synchronously from the seed; past dates are fetched on
  // demand, one date at a time, so it never trips PostgREST's row cap.
  const todaySeed = useMemo(() => {
    const map: Record<string, Enums<"attendance_status">> = {};
    for (const r of todayRecords) map[r.student_id] = r.status;
    return map;
  }, [todayRecords]);
  // Locally-applied saves, so a save stays reflected after overrides clear.
  const [localSaves, setLocalSaves] = useState<Record<string, Record<string, Enums<"attendance_status">>>>({});
  // Fetched baselines for past dates, keyed by `${classId}|${date}`.
  const [fetched, setFetched] = useState<Record<string, Record<string, Enums<"attendance_status">>>>({});

  const key = `${classId}|${date}`;
  const isToday = date === today;
  const baselineLoaded = isToday || classStudentIds.length === 0 || key in fetched;
  const loadingBaseline = !baselineLoaded;

  const savedByStudent = useMemo(() => {
    const base = isToday ? todaySeed : fetched[key] ?? {};
    const overlay = localSaves[key];
    return overlay ? { ...base, ...overlay } : base;
  }, [isToday, todaySeed, fetched, key, localSaves]);

  useEffect(() => {
    if (isToday || classStudentIds.length === 0 || key in fetched) return;
    let cancelled = false;
    getAttendanceForDate(date, classStudentIds)
      .then((rows) => {
        const map: Record<string, Enums<"attendance_status">> = {};
        for (const r of rows) map[r.student_id] = r.status;
        if (!cancelled) setFetched((prev) => ({ ...prev, [key]: map }));
      })
      .catch(() => {
        if (!cancelled) setFetched((prev) => ({ ...prev, [key]: {} }));
      });
    return () => {
      cancelled = true;
    };
  }, [isToday, key, date, classStudentIds, fetched]);

  function statusFor(studentId: string): Enums<"attendance_status"> {
    return overrides[studentId] ?? savedByStudent[studentId] ?? "present";
  }

  function setStatus(studentId: string, status: Enums<"attendance_status">) {
    setSaved(false);
    setOverrides((prev) => ({ ...prev, [studentId]: status }));
  }

  function onClassOrDateChange(next: { classId?: string; date?: string }) {
    setOverrides({});
    setSaved(false);
    setError(null);
    if (next.classId !== undefined) setClassId(next.classId);
    if (next.date !== undefined) setDate(next.date);
  }

  function save() {
    setError(null);
    const entries = students.map((s) => ({ studentId: s.id, status: statusFor(s.id) }));
    startTransition(async () => {
      try {
        await saveAttendance(date, entries);
        setSaved(true);
        // Fold the save into the baseline so it stays reflected after overrides
        // clear, without waiting on a re-fetch.
        setLocalSaves((prev) => {
          const forKey = { ...(prev[key] ?? {}) };
          for (const e of entries) forKey[e.studentId] = e.status;
          return { ...prev, [key]: forKey };
        });
        setOverrides({});
        toast.success(`Attendance saved for ${entries.length} student${entries.length === 1 ? "" : "s"}`);
        // Update the parent's own snapshot immediately — don't rely solely on
        // the server round trip picking up the new records.
        onSaved?.(date, entries);
        // Belt-and-suspenders: the server action already revalidates this path,
        // and this refresh also keeps the class-cards page in sync once visited.
        router.refresh();
      } catch (e) {
        const message = (e as Error).message;
        setError(message);
        toast.error(message || "Couldn't save attendance");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        {classes.length > 1 && (
          <label className="flex flex-col gap-1.5 text-base">
            <span className="font-medium text-maroon">Class</span>
            <div className="w-56">
              <ComboBox
                options={classes.map((c) => ({
                  value: c.id,
                  label: `Grade ${c.grade} - ${c.section}`,
                }))}
                value={classId}
                onChange={(next) => onClassOrDateChange({ classId: next })}
                required
                placeholder="Search class…"
                ariaLabel="Class"
                recallKey="attendance-marker-class"
              />
            </div>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Date</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => onClassOrDateChange({ date: e.target.value })}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
      </div>

      <ul className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        {students.map((s) => {
          const current = statusFor(s.id);
          return (
            <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-base text-slate-strong">
                {s.first_name} {s.last_name}
                <span className="ml-2 text-sm text-slate">Roll {s.roll_no}</span>
              </span>
              <div className="flex gap-1">
                {STATUSES.map((st) => {
                  const on = current === st.value;
                  return (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setStatus(s.id, st.value)}
                      title={st.value}
                      className={`h-9 w-9 rounded-sm border text-base font-semibold transition ${
                        on ? st.active : "border-hairline bg-mist text-slate-strong hover:bg-parchment"
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
        {students.length === 0 && (
          <li className="px-5 py-4 text-base text-slate">No students in this class.</li>
        )}
      </ul>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending || loadingBaseline || students.length === 0}
          className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          {isPending ? "Saving…" : loadingBaseline ? "Loading…" : "Save attendance"}
        </button>
        <span className="text-sm text-slate">P present · A absent · L late · H half day</span>
        {saved && <span className="text-base text-emerald-700">Saved.</span>}
        {error && <span className="text-base text-rose-700">{error}</span>}
      </div>
    </div>
  );
}
