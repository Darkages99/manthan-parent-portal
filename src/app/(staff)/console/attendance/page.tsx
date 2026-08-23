import { redirect } from "next/navigation";
import { AttendanceAnalytics } from "@/components/attendance-analytics";
import { ExportCsvButton } from "@/components/export-csv-button";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchAttendanceForDate } from "@/lib/attendance-today";
import type { Tables } from "@/lib/supabase/database.types";

type AttendanceSummary = { student_id: string; total: number; present_pct: number };

/** Today's date in IST as YYYY-MM-DD (matches how attendance is marked). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function StaffAttendance({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; mark?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  const { classId: requestedClassId, mark } = await searchParams;

  const supabase = await createClient();
  const today = istToday();

  // Class teachers see their own class; principal / office roles see any class.
  const { data: allClasses } = await supabase.from("class_sections").select("*").order("grade");
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);

  const classIds = classes.map((c) => c.id);

  // Students first — their ids scope every attendance read below so we never
  // pull the whole attendance_records table (which exceeds PostgREST's row cap
  // once it grows, dropping recent rows and making saves look like no-ops).
  const { data: students } = classIds.length
    ? await supabase.from("students").select("*").in("class_section_id", classIds).order("roll_no")
    : { data: [] as Tables<"students">[] };
  const studentIds = (students ?? []).map((s) => s.id);

  const [todayRecords, { data: summaries }, { data: leaves }] = await Promise.all([
    // Only today's rows drive the snapshot / absent list / marker baseline.
    fetchAttendanceForDate(supabase, today, studentIds),
    // Term percentages are aggregated in the DB — one row per student. Passed
    // in the POST body, so no query-URL size limit even for the whole school.
    studentIds.length
      ? supabase.rpc("attendance_summary", { p_student_ids: studentIds })
      : Promise.resolve({ data: [] as AttendanceSummary[] }),
    supabase
      .from("leave_requests")
      .select("student_id")
      .eq("status", "approved")
      .lte("from_date", today)
      .gte("to_date", today),
  ]);

  const approvedTodayStudentIds = [...new Set((leaves ?? []).map((l) => l.student_id))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Register</p>
          <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Attendance</h1>
          <p className="mt-2 max-w-prose text-lg text-slate-strong">
            Who&apos;s in today, who&apos;s missing, and who&apos;s slipping below the {""}
            minimum. Marking is available at the bottom.
          </p>
        </div>
        <ExportCsvButton href="/api/export/attendance" />
      </div>

      {classes.length === 0 ? (
        <p className="text-base text-slate">No class is assigned to you.</p>
      ) : (
        <AttendanceAnalytics
          classes={classes}
          students={students ?? []}
          todayRecords={todayRecords}
          summaries={(summaries as AttendanceSummary[]) ?? []}
          approvedTodayStudentIds={approvedTodayStudentIds}
          today={today}
          initialClassId={requestedClassId}
          initialMarkOpen={mark === "1"}
        />
      )}
    </div>
  );
}
