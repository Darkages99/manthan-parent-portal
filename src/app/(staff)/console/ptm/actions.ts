"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";
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
 * and slot length. Only super_admin/principal may create one; it must name
 * one or more teachers (notified on every booking decision) and exactly one
 * `front_office`-role staff member, who — along with any super_admin — is the
 * only one who can approve or decline that meeting's slot bookings. The card
 * appears immediately; slots are opened separately from the meeting's own
 * page, generated from the window stored here. */
export async function createMeeting(input: {
  classSectionId: string;
  meetingDate: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  slotMinutes: number;
  teacherIds: string[];
  adminId: string;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (viewer.staff.role !== "super_admin" && viewer.staff.role !== "principal") {
    throw new Error("Only a super admin or principal can create a PTM");
  }
  if (!input.classSectionId || !input.meetingDate) throw new Error("Class and date are required");
  if (input.teacherIds.length === 0) throw new Error("Assign at least one teacher");
  if (!input.adminId) throw new Error("Assign a front office staff member to approve bookings for this PTM");
  if (input.windowStart && input.windowEnd && input.windowEnd <= input.windowStart) {
    throw new Error("End time must be after start time");
  }
  if (input.slotMinutes < 5) throw new Error("Slot length is too short");

  const supabase = await createClient();

  const { data: admin } = await supabase.from("staff").select("role").eq("id", input.adminId).single();
  if (admin?.role !== "front_office") throw new Error("The assigned approver must have the Front office role");

  const { data, error } = await supabase
    .from("ptm_meetings")
    .insert({
      class_section_id: input.classSectionId,
      teacher_id: input.teacherIds[0],
      assigned_admin_id: input.adminId,
      meeting_date: input.meetingDate,
      title: input.title.trim() || null,
      window_start: input.windowStart || null,
      window_end: input.windowEnd || null,
      slot_minutes: input.slotMinutes || 15,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { error: teachersError } = await supabase
    .from("ptm_meeting_teachers")
    .insert(input.teacherIds.map((teacherId) => ({ meeting_id: data.id, teacher_id: teacherId })));
  if (teachersError) throw new Error(teachersError.message);

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
 * Records the caller's decision on a PTM slot booking request. Only the
 * meeting's assigned front-office approver, or any super_admin, may decide —
 * a single decision-maker rather than the generic multi-role approval chain
 * used elsewhere. Once approved, the provisional hold becomes the final
 * booking; a decline reopens the slot. Either way, every teacher on the
 * meeting gets a lightweight push notification.
 */
export async function decidePtmBooking(
  slotId: string,
  meetingId: string,
  decision: Enums<"approval_decision">
) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("ptm_meetings")
    .select("assigned_admin_id")
    .eq("id", meetingId)
    .single();
  if (!meeting) throw new Error("Meeting not found");
  if (viewer.staff.id !== meeting.assigned_admin_id && viewer.staff.role !== "super_admin") {
    throw new Error("Only this PTM's assigned front office approver (or a super admin) can decide bookings");
  }

  const { error: stepError } = await supabase.from("approval_steps").upsert(
    {
      subject_type: "ptm_slot_request",
      subject_id: slotId,
      step_order: 1,
      approver_role: "principal",
      approver_staff_id: viewer.staff.id,
      decision,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "subject_type,subject_id,step_order" }
  );
  if (stepError) throw new Error(stepError.message);

  let studentId: string | null = null;
  if (decision === "approved") {
    const { data: slot } = await supabase
      .from("ptm_slots")
      .select("pending_guardian_id, booked_student_id")
      .eq("id", slotId)
      .single();
    studentId = slot?.booked_student_id ?? null;
    if (slot?.pending_guardian_id) {
      const { error } = await supabase
        .from("ptm_slots")
        .update({ booked_by_guardian_id: slot.pending_guardian_id, pending_guardian_id: null })
        .eq("id", slotId);
      if (error) throw new Error(error.message);
    }
  } else {
    const { data: slot } = await supabase
      .from("ptm_slots")
      .select("booked_student_id")
      .eq("id", slotId)
      .single();
    studentId = slot?.booked_student_id ?? null;
    const { error } = await supabase
      .from("ptm_slots")
      .update({ pending_guardian_id: null, booked_student_id: null })
      .eq("id", slotId);
    if (error) throw new Error(error.message);
  }

  const { data: teacherLinks } = await supabase
    .from("ptm_meeting_teachers")
    .select("teacher_id")
    .eq("meeting_id", meetingId);
  const { data: student } = studentId
    ? await supabase.from("students").select("first_name, last_name").eq("id", studentId).maybeSingle()
    : { data: null };
  const studentName = student ? `${student.first_name} ${student.last_name}` : "a student";

  await sendPush(
    (teacherLinks ?? []).map((t) => ({ userId: t.teacher_id, role: "staff" as const })),
    {
      title: decision === "approved" ? "PTM slot approved" : "PTM slot declined",
      body: `${studentName}'s slot was ${decision}.`,
      url: `/console/ptm/${meetingId}`,
    },
    "ptm"
  );

  revalidatePath(`/console/ptm/${meetingId}`);
  revalidatePath("/console/ptm");
}
