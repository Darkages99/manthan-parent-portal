"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";
import type { Enums } from "@/lib/supabase/database.types";

type Entry = { studentId: string; status: Enums<"attendance_status"> };

export async function saveAttendance(date: string, entries: Entry[]) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!date) throw new Error("Pick a date");
  if (entries.length === 0) return;

  const supabase = await createClient();
  const rows = entries.map((e) => ({
    student_id: e.studentId,
    date,
    status: e.status,
    marked_by: viewer.staff.id,
  }));

  const { error } = await supabase
    .from("attendance_records")
    .upsert(rows, { onConflict: "student_id,date" });

  if (error) throw new Error(error.message);
  revalidatePath("/console/attendance");
  revalidatePath("/console/attendance/classes");
}

/** Nudges a class teacher to mark today's attendance for their class. */
export async function notifyTeacherToMarkAttendance(classSectionId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: classSection, error } = await supabase
    .from("class_sections")
    .select("grade, section, class_teacher_id")
    .eq("id", classSectionId)
    .single();
  if (error || !classSection) throw new Error(error?.message ?? "Class not found");
  if (!classSection.class_teacher_id) throw new Error("This class has no class teacher assigned");

  await sendPush(
    [{ userId: classSection.class_teacher_id, role: "staff" }],
    {
      title: "Mark today's attendance",
      body: `Grade ${classSection.grade}-${classSection.section} hasn't had attendance marked yet today.`,
      url: "/console/attendance",
    },
    "reminders"
  );
}
