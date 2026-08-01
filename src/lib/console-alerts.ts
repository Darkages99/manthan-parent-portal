import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_THRESHOLD, presentPercent } from "@/lib/attendance";
import type { Tables } from "@/lib/supabase/database.types";

export type LowAttendanceStudent = {
  id: string;
  name: string;
  className: string;
  pct: number;
};

/** All students absent (via approved leave) on one calendar day. */
export type DayAbsence = {
  date: string;
  students: { name: string; reason: string }[];
};

export type UninformedAbsence = {
  id: string;
  name: string;
  className: string;
};

export type ConsoleAlertData = {
  lowAttendance: LowAttendanceStudent[];
  dayAbsences: DayAbsence[];
  uninformedToday: UninformedAbsence[];
};

/** Today's date in IST as YYYY-MM-DD (matches how dates are stored/marked). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Every calendar day (YYYY-MM-DD) in [from, to], inclusive. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Computes the principal/teacher dashboard alerts, scoped to the staff member's
 * classes (class teacher → own classes; other roles → all). Three kinds:
 *  - students below the school attendance minimum,
 *  - upcoming approved absences grouped one-per-day,
 *  - students absent today with no approved leave (uninformed).
 */
export async function getConsoleAlerts(staff: Tables<"staff">): Promise<ConsoleAlertData> {
  const supabase = await createClient();
  const today = istToday();
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const { data: allClasses } = await supabase.from("class_sections").select("*");
  const classes =
    staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === staff.id)
      : (allClasses ?? []);
  const classIds = classes.map((c) => c.id);
  const classLabel = (id: string) => {
    const c = classes.find((cs) => cs.id === id);
    return c ? `Grade ${c.grade}-${c.section}` : "";
  };

  if (classIds.length === 0) {
    return { lowAttendance: [], dayAbsences: [], uninformedToday: [] };
  }

  const [{ data: students }, { data: records }, { data: leaves }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, class_section_id")
      .in("class_section_id", classIds),
    supabase.from("attendance_records").select("student_id, date, status"),
    supabase
      .from("leave_requests")
      .select("student_id, from_date, to_date, reason, status")
      .eq("status", "approved")
      .gte("to_date", today),
  ]);

  const studentList = students ?? [];
  const studentIds = new Set(studentList.map((s) => s.id));
  const nameOf = (id: string) => {
    const s = studentList.find((st) => st.id === id);
    return s ? `${s.first_name} ${s.last_name}` : "Student";
  };
  const classOf = (id: string) => {
    const s = studentList.find((st) => st.id === id);
    return s ? classLabel(s.class_section_id) : "";
  };

  // --- Low attendance (below the school minimum) ---
  const recordsByStudent = new Map<string, { status: Tables<"attendance_records">["status"] }[]>();
  for (const r of records ?? []) {
    if (!studentIds.has(r.student_id)) continue;
    const arr = recordsByStudent.get(r.student_id) ?? [];
    arr.push({ status: r.status });
    recordsByStudent.set(r.student_id, arr);
  }
  const lowAttendance: LowAttendanceStudent[] = [];
  for (const s of studentList) {
    const recs = recordsByStudent.get(s.id) ?? [];
    if (recs.length === 0) continue;
    const pct = presentPercent(recs);
    if (pct < ATTENDANCE_THRESHOLD) {
      lowAttendance.push({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        className: classLabel(s.class_section_id),
        pct,
      });
    }
  }
  lowAttendance.sort((a, b) => a.pct - b.pct);

  // --- Approved absences, one alert per day (today .. +30d) ---
  const byDay = new Map<string, { name: string; reason: string }[]>();
  for (const l of leaves ?? []) {
    if (!studentIds.has(l.student_id)) continue;
    const start = l.from_date > today ? l.from_date : today;
    const end = l.to_date < horizonDate ? l.to_date : horizonDate;
    for (const day of daysBetween(start, end)) {
      const arr = byDay.get(day) ?? [];
      arr.push({ name: nameOf(l.student_id), reason: l.reason });
      byDay.set(day, arr);
    }
  }
  const dayAbsences: DayAbsence[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, studentsOnDay]) => ({ date, students: studentsOnDay }));

  // --- Uninformed absences today (absent, no approved leave covering today) ---
  const approvedTodayStudentIds = new Set(
    (leaves ?? [])
      .filter((l) => l.from_date <= today && l.to_date >= today)
      .map((l) => l.student_id)
  );
  const uninformedToday: UninformedAbsence[] = (records ?? [])
    .filter(
      (r) =>
        r.date === today &&
        r.status === "absent" &&
        studentIds.has(r.student_id) &&
        !approvedTodayStudentIds.has(r.student_id)
    )
    .map((r) => ({ id: r.student_id, name: nameOf(r.student_id), className: classOf(r.student_id) }));

  return { lowAttendance, dayAbsences, uninformedToday };
}
