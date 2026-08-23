import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import type { Tables } from "@/lib/supabase/database.types";

export type LowAttendanceStudent = {
  id: string;
  name: string;
  className: string;
  pct: number;
};

export type PendingRequest = {
  id: string;
  name: string;
  className: string;
};

/** Every student absent today, whether covered by approved leave or not. */
export type AbsentToday = {
  id: string;
  name: string;
  className: string;
  reason: string;
};

/** A student who scored below the pass mark in one or more subjects. */
export type LowScoreStudent = {
  id: string;
  name: string;
  className: string;
  subjects: string[];
};

export type ConsoleAlertData = {
  lowAttendance: LowAttendanceStudent[];
  pendingLeave: PendingRequest[];
  pendingStayBack: PendingRequest[];
  absentToday: AbsentToday[];
  lowScores: LowScoreStudent[];
};

/** Marks at or below this fraction of the maximum count as failing. */
export const PASS_FRACTION = 0.4;

/** Today's date in IST as YYYY-MM-DD (matches how dates are stored/marked). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Computes the principal/teacher dashboard alerts, scoped to the staff member's
 * classes (class teacher → own classes; other roles → all). Four kinds:
 *  - students below the school attendance minimum,
 *  - new (pending) leave requests awaiting a decision,
 *  - new (pending) stay-back requests awaiting a decision,
 *  - a single alert listing everyone absent today (approved leave or not).
 */
export async function getConsoleAlerts(staff: Tables<"staff">): Promise<ConsoleAlertData> {
  const supabase = await createClient();
  const today = istToday();

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
    return { lowAttendance: [], pendingLeave: [], pendingStayBack: [], absentToday: [], lowScores: [] };
  }

  // Students first — their ids scope the attendance reads below so we never
  // pull the whole attendance_records table (which exceeds PostgREST's row cap
  // once it grows, dropping recent rows from the result).
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, class_section_id")
    .in("class_section_id", classIds);
  const studentList = students ?? [];
  const studentIds = new Set(studentList.map((s) => s.id));
  const studentIdList = studentList.map((s) => s.id);

  const [
    { data: summaries },
    { data: todayRecords },
    { data: leaves },
    { data: pendingLeaves },
    { data: pendingStayBacks },
    { data: examResults },
  ] = await Promise.all([
      studentIdList.length
        ? supabase.rpc("attendance_summary", { p_student_ids: studentIdList })
        : Promise.resolve({ data: [] as { student_id: string; total: number; present_pct: number }[] }),
      studentIdList.length
        ? supabase
            .from("attendance_records")
            .select("student_id, status")
            .eq("date", today)
            .in("student_id", studentIdList)
        : Promise.resolve({ data: [] as { student_id: string; status: Tables<"attendance_records">["status"] }[] }),
      supabase
        .from("leave_requests")
        .select("student_id, from_date, to_date, reason, status")
        .eq("status", "approved")
        .lte("from_date", today)
        .gte("to_date", today),
      supabase
        .from("leave_requests")
        .select("id, student_id")
        .eq("status", "pending"),
      supabase
        .from("stay_back_consents")
        .select("id, student_id")
        .eq("status", "pending"),
      supabase.from("exam_results").select("student_id, subject, marks, max_marks"),
    ]);
  const nameOf = (id: string) => {
    const s = studentList.find((st) => st.id === id);
    return s ? `${s.first_name} ${s.last_name}` : "Student";
  };
  const classOf = (id: string) => {
    const s = studentList.find((st) => st.id === id);
    return s ? classLabel(s.class_section_id) : "";
  };

  // --- Low attendance (below the school minimum) — from the DB aggregate ---
  const summaryByStudent = new Map((summaries ?? []).map((s) => [s.student_id, s]));
  const lowAttendance: LowAttendanceStudent[] = [];
  for (const s of studentList) {
    const summary = summaryByStudent.get(s.id);
    if (!summary || summary.total === 0) continue;
    if (summary.present_pct < ATTENDANCE_THRESHOLD) {
      lowAttendance.push({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        className: classLabel(s.class_section_id),
        pct: summary.present_pct,
      });
    }
  }
  lowAttendance.sort((a, b) => a.pct - b.pct);

  // --- New (pending) leave and stay-back requests, scoped to these classes ---
  const pendingLeave: PendingRequest[] = (pendingLeaves ?? [])
    .filter((l) => studentIds.has(l.student_id))
    .map((l) => ({ id: l.id, name: nameOf(l.student_id), className: classOf(l.student_id) }));

  const pendingStayBack: PendingRequest[] = (pendingStayBacks ?? [])
    .filter((s) => studentIds.has(s.student_id))
    .map((s) => ({ id: s.id, name: nameOf(s.student_id), className: classOf(s.student_id) }));

  // --- Everyone absent today, one alert — approved-leave reason, or uninformed ---
  const approvedTodayReason = new Map((leaves ?? []).map((l) => [l.student_id, l.reason]));
  const absentToday: AbsentToday[] = (todayRecords ?? [])
    .filter((r) => r.status === "absent" && studentIds.has(r.student_id))
    .map((r) => ({
      id: r.student_id,
      name: nameOf(r.student_id),
      className: classOf(r.student_id),
      reason: approvedTodayReason.get(r.student_id) ?? "No approved leave on record",
    }));

  // --- Students failing (≤40%) one or more subjects, one alert per student ---
  const failingSubjects = new Map<string, Set<string>>();
  for (const r of examResults ?? []) {
    if (!studentIds.has(r.student_id)) continue;
    const max = Number(r.max_marks);
    if (max <= 0) continue;
    if (Number(r.marks) / max <= PASS_FRACTION) {
      const set = failingSubjects.get(r.student_id) ?? new Set<string>();
      set.add(r.subject);
      failingSubjects.set(r.student_id, set);
    }
  }
  const lowScores: LowScoreStudent[] = [...failingSubjects.entries()]
    .map(([id, subjects]) => ({
      id,
      name: nameOf(id),
      className: classOf(id),
      subjects: [...subjects].sort(),
    }))
    .sort((a, b) => b.subjects.length - a.subjects.length);

  return { lowAttendance, pendingLeave, pendingStayBack, absentToday, lowScores };
}
