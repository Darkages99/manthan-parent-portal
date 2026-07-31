import { redirect } from "next/navigation";
import { AttendanceMarker } from "@/components/attendance-marker";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function StaffAttendance() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();

  // Class teachers mark their own class; principal / office roles can mark any class.
  const classQuery = supabase.from("class_sections").select("*").order("grade");
  const { data: allClasses } = await classQuery;
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);

  const classIds = classes.map((c) => c.id);
  const [{ data: students }, { data: records }] = await Promise.all([
    classIds.length
      ? supabase.from("students").select("*").in("class_section_id", classIds).order("roll_no")
      : Promise.resolve({ data: [] as Tables<"students">[] }),
    classIds.length
      ? supabase.from("attendance_records").select("*")
      : Promise.resolve({ data: [] as Tables<"attendance_records">[] }),
  ]);

  const studentsByClass: Record<string, Tables<"students">[]> = {};
  for (const c of classes) studentsByClass[c.id] = [];
  for (const s of students ?? []) studentsByClass[s.class_section_id]?.push(s);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Register</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Mark attendance</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Set each student&apos;s status for the day. Saving updates what parents see instantly.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="text-base text-slate">No class is assigned to you for marking.</p>
      ) : (
        <AttendanceMarker
          classes={classes}
          studentsByClass={studentsByClass}
          records={records ?? []}
        />
      )}
    </div>
  );
}
