"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import type { Enums } from "@/lib/supabase/database.types";

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

/** Creates a PTM meeting for a class on a date. The card appears immediately;
 * slots are opened separately from the meeting's own page. */
export async function createMeeting(input: {
  classSectionId: string;
  meetingDate: string;
  title: string;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!input.classSectionId || !input.meetingDate) throw new Error("Class and date are required");

  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("class_sections")
    .select("class_teacher_id")
    .eq("id", input.classSectionId)
    .single();
  const teacherId = cls?.class_teacher_id ?? viewer.staff.id;

  const { data, error } = await supabase
    .from("ptm_meetings")
    .insert({
      class_section_id: input.classSectionId,
      teacher_id: teacherId,
      meeting_date: input.meetingDate,
      title: input.title.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/console/ptm");
  revalidatePath("/console", "layout"); // refresh the nav's meeting list
  return data.id as string;
}

/** Toggles a meeting open/closed. Closed meetings are hidden from parents' booking. */
export async function setMeetingStatus(meetingId: string, status: Enums<"ptm_status">) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { error } = await supabase.from("ptm_meetings").update({ status }).eq("id", meetingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/console/ptm/${meetingId}`);
  revalidatePath("/console/ptm");
}

/** Deletes a meeting (and its open slots). Refuses if any slot is already booked. */
export async function deleteMeeting(meetingId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { count } = await supabase
    .from("ptm_slots")
    .select("*", { count: "exact", head: true })
    .eq("meeting_id", meetingId)
    .not("booked_by_guardian_id", "is", null);
  if ((count ?? 0) > 0) throw new Error("Can't delete — some slots are already booked.");

  const { error } = await supabase.from("ptm_meetings").delete().eq("id", meetingId);
  if (error) throw new Error(error.message);
  revalidatePath("/console/ptm");
  revalidatePath("/console", "layout");
}

/** Opens a run of equal-length booking slots inside a meeting. */
export async function createSlots(input: {
  meetingId: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const { meetingId, startTime, endTime, slotMinutes } = input;
  if (!meetingId || !startTime || !endTime) throw new Error("All fields are required");
  if (endTime <= startTime) throw new Error("End time must be after start time");
  if (slotMinutes < 5) throw new Error("Slot length is too short");

  const supabase = await createClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("ptm_meetings")
    .select("id, class_section_id, teacher_id, meeting_date")
    .eq("id", meetingId)
    .single();
  if (meetingError || !meeting) throw new Error("Meeting not found");

  const rows: {
    meeting_id: string;
    teacher_id: string;
    class_section_id: string;
    starts_at: string;
    ends_at: string;
  }[] = [];
  let cursor = startTime;
  while (addMinutes(cursor, slotMinutes) <= endTime) {
    const next = addMinutes(cursor, slotMinutes);
    rows.push({
      meeting_id: meeting.id,
      teacher_id: meeting.teacher_id,
      class_section_id: meeting.class_section_id,
      starts_at: toIst(meeting.meeting_date, cursor),
      ends_at: toIst(meeting.meeting_date, next),
    });
    cursor = next;
  }

  if (rows.length === 0) throw new Error("That window doesn't fit a single slot");

  const { error } = await supabase.from("ptm_slots").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath(`/console/ptm/${meetingId}`);
}

/** Removes a single open (unbooked) slot from a meeting. */
export async function deleteSlot(slotId: string, meetingId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ptm_slots")
    .delete()
    .eq("id", slotId)
    .is("booked_by_guardian_id", null);

  if (error) throw new Error(error.message);
  revalidatePath(`/console/ptm/${meetingId}`);
}
