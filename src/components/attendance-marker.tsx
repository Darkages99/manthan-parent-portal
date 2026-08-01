"use client";

import { useMemo, useState, useTransition } from "react";
import { saveAttendance } from "@/app/(staff)/console/attendance/actions";
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

const TODAY = new Date().toISOString().slice(0, 10);

export function AttendanceMarker({
  classes,
  studentsByClass,
  records,
}: {
  classes: ClassSection[];
  studentsByClass: Record<string, Student[]>;
  records: AttendanceRecord[];
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(TODAY);
  const [overrides, setOverrides] = useState<Record<string, Enums<"attendance_status">>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const students = studentsByClass[classId] ?? [];

  // Baseline from what's already saved for this class + date.
  const savedByStudent = useMemo(() => {
    const map: Record<string, Enums<"attendance_status">> = {};
    for (const r of records) if (r.date === date) map[r.student_id] = r.status;
    return map;
  }, [records, date]);

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
        setOverrides({});
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        {classes.length > 1 && (
          <label className="flex flex-col gap-1.5 text-base">
            <span className="font-medium text-maroon">Class</span>
            <select
              value={classId}
              onChange={(e) => onClassOrDateChange({ classId: e.target.value })}
              className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Grade {c.grade} - {c.section}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Date</span>
          <input
            type="date"
            value={date}
            max={TODAY}
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
          disabled={isPending || students.length === 0}
          className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save attendance"}
        </button>
        <span className="text-sm text-slate">P present · A absent · L late · H half day</span>
        {saved && <span className="text-base text-emerald-700">Saved.</span>}
        {error && <span className="text-base text-rose-700">{error}</span>}
      </div>
    </div>
  );
}
