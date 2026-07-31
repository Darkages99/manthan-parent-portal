"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

function toIst(date: string, hhmm: string): string {
  // Build an IST (+05:30) timestamptz from a date and "HH:MM".
  return `${date}T${hhmm}:00+05:30`;
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function createSlots(input: {
  classSectionId: string;
  date: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const { classSectionId, date, startTime, endTime, slotMinutes } = input;
  if (!classSectionId || !date || !startTime || !endTime) throw new Error("All fields are required");
  if (endTime <= startTime) throw new Error("End time must be after start time");
  if (slotMinutes < 5) throw new Error("Slot length is too short");

  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("class_sections")
    .select("class_teacher_id")
    .eq("id", classSectionId)
    .single();
  const teacherId = cls?.class_teacher_id ?? viewer.staff.id;

  const rows: { teacher_id: string; class_section_id: string; starts_at: string; ends_at: string }[] = [];
  let cursor = startTime;
  while (addMinutes(cursor, slotMinutes) <= endTime) {
    const next = addMinutes(cursor, slotMinutes);
    rows.push({
      teacher_id: teacherId,
      class_section_id: classSectionId,
      starts_at: toIst(date, cursor),
      ends_at: toIst(date, next),
    });
    cursor = next;
  }

  if (rows.length === 0) throw new Error("That window doesn't fit a single slot");

  const { error } = await supabase.from("ptm_slots").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/console/ptm");
}

export async function deleteSlot(slotId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ptm_slots")
    .delete()
    .eq("id", slotId)
    .is("booked_by_guardian_id", null);

  if (error) throw new Error(error.message);
  revalidatePath("/console/ptm");
}
