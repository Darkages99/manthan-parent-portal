import { redirect } from "next/navigation";
import { AttendanceAnalytics } from "@/components/attendance-analytics";
import { ExportCsvButton } from "@/components/export-csv-button";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/** Today's date in IST as YYYY-MM-DD (matches how attendance is marked). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function StaffAttendance() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const today = istToday();

  // Class teachers see their own class; principal / office roles see any class.
  const { data: allClasses } = await supabase.from("class_sections").select("*").order("grade");
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);

  const classIds = classes.map((c) => c.id);
  const [{ data: students }, { data: records }, { data: leaves }] = await Promise.all([
    classIds.length
      ? supabase.from("students").select("*").in("class_section_id", classIds).order("roll_no")
      : Promise.resolve({ data: [] as Tables<"students">[] }),
    classIds.length
      ? supabase.from("attendance_records").select("*")
      : Promise.resolve({ data: [] as Tables<"attendance_records">[] }),
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
          records={records ?? []}
          approvedTodayStudentIds={approvedTodayStudentIds}
          today={today}
        />
      )}
    </div>
  );
}
