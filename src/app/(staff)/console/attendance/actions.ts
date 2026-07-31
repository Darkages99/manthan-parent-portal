"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
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
}
