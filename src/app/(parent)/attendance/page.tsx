import { redirect } from "next/navigation";
import { AttendanceView } from "@/components/attendance-view";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function AttendancePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);
  const { data: records } = await supabase
    .from("attendance_records")
    .select("*")
    .in("student_id", studentIds);

  const recordsByStudent: Record<string, Tables<"attendance_records">[]> = {};
  for (const id of studentIds) recordsByStudent[id] = [];
  for (const r of records ?? []) recordsByStudent[r.student_id]?.push(r);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Daily register</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Attendance</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Present, absent, late and excused days, from the register the class teacher marks each
          morning.
        </p>
      </div>

      <AttendanceView students={viewer.students} recordsByStudent={recordsByStudent} />
    </div>
  );
}
