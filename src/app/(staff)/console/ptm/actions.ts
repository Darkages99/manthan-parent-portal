"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { decideApprovalStep } from "@/lib/approvals";
import { resolveApproverRole } from "@/lib/ptm-approval";
import { formatTime } from "@/lib/format";
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

/** Creates a PTM meeting for a class on a date, with its own booking window
 * and slot length. The card appears immediately; slots are opened separately
 * from the meeting's own page, generated from the window stored here. */
export async function createMeeting(input: {
  classSectionId: string;
  meetingDate: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  slotMinutes: number;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!input.classSectionId || !input.meetingDate) throw new Error("Class and date are required");
  if (input.windowStart && input.windowEnd && input.windowEnd <= input.windowStart) {
    throw new Error("End time must be after start time");
  }
  if (input.slotMinutes < 5) throw new Error("Slot length is too short");

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
      window_start: input.windowStart || null,
      window_end: input.windowEnd || null,
      slot_minutes: input.slotMinutes || 15,
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

/** Deletes a meeting (and its open slots). Refuses if any slot is already
 * booked or has a booking under review. */
export async function deleteMeeting(meetingId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { count } = await supabase
    .from("ptm_slots")
    .select("*", { count: "exact", head: true })
    .eq("meeting_id", meetingId)
    .or("booked_by_guardian_id.not.is.null,pending_guardian_id.not.is.null");
  if ((count ?? 0) > 0) throw new Error("Can't delete — some slots are booked or under review.");

  const { error } = await supabase.from("ptm_meetings").delete().eq("id", meetingId);
  if (error) throw new Error(error.message);
  revalidatePath("/console/ptm");
  revalidatePath("/console", "layout");
}

/** Opens a run of equal-length booking slots inside a meeting, generated
 * from the meeting's own window_start/window_end/slot_minutes. */
export async function createSlots(meetingId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!meetingId) throw new Error("Meeting is required");

  const supabase = await createClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("ptm_meetings")
    .select("id, class_section_id, teacher_id, meeting_date, window_start, window_end, slot_minutes")
    .eq("id", meetingId)
    .single();
  if (meetingError || !meeting) throw new Error("Meeting not found");
  if (!meeting.window_start || !meeting.window_end) {
    throw new Error("Set the meeting's booking window before opening slots");
  }

  const startTime = formatTime(meeting.window_start);
  const endTime = formatTime(meeting.window_end);
  const slotMinutes = meeting.slot_minutes;
  if (endTime <= startTime) throw new Error("End time must be after start time");
  if (slotMinutes < 5) throw new Error("Slot length is too short");

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

/** Removes a single open (unbooked, not under review) slot from a meeting. */
export async function deleteSlot(slotId: string, meetingId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ptm_slots")
    .delete()
    .eq("id", slotId)
    .is("booked_by_guardian_id", null)
    .is("pending_guardian_id", null);

  if (error) throw new Error(error.message);
  revalidatePath(`/console/ptm/${meetingId}`);
}

/**
 * Records the caller's decision on a PTM slot booking request. Resolves
 * which approval step the caller acts as the same way the stay-back module
 * does (principal role also accepts super_admin); the named class teacher's
 * step is matched by their own staff id. Once every step approves, the
 * provisional hold becomes the final booking; any decline reopens the slot.
 */
export async function decidePtmBooking(
  slotId: string,
  meetingId: string,
  decision: Enums<"approval_decision">
) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const approverRole = resolveApproverRole(viewer.staff.role);
  if (!approverRole) throw new Error("You aren't authorized to decide this request");

  const supabase = await createClient();
  const status = await decideApprovalStep(supabase, {
    subjectType: "ptm_slot_request",
    subjectId: slotId,
    approverRole,
    staffId: viewer.staff.id,
    decision,
    matchByStaffId: approverRole === "class_teacher",
  });

  if (status === "approved") {
    const { data: slot } = await supabase
      .from("ptm_slots")
      .select("pending_guardian_id")
      .eq("id", slotId)
      .single();
    if (slot?.pending_guardian_id) {
      const { error } = await supabase
        .from("ptm_slots")
        .update({ booked_by_guardian_id: slot.pending_guardian_id, pending_guardian_id: null })
        .eq("id", slotId);
      if (error) throw new Error(error.message);
    }
  } else if (status === "declined") {
    const { error } = await supabase
      .from("ptm_slots")
      .update({ pending_guardian_id: null, booked_student_id: null })
      .eq("id", slotId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/console/ptm/${meetingId}`);
  revalidatePath("/console/ptm");
}
