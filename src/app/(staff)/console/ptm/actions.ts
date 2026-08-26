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
 * and slot length. Only super_admin/principal may create one — plain
 * first-come-first-served booking, no teacher assignment or approval step.
 * The card appears immediately; slots are opened separately from the
 * meeting's own page, generated from the window stored here. */
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
  if (viewer.staff.role !== "super_admin" && viewer.staff.role !== "principal") {
    throw new Error("Only a super admin or principal can create a PTM");
  }
  if (!input.classSectionId || !input.meetingDate) throw new Error("Class and date are required");
  if (input.windowStart && input.windowEnd && input.windowEnd <= input.windowStart) {
    throw new Error("End time must be after start time");
  }
  if (input.slotMinutes < 5) throw new Error("Slot length is too short");

  const supabase = await createClient();

  const { data: classSection } = await supabase
    .from("class_sections")
    .select("class_teacher_id")
    .eq("id", input.classSectionId)
    .single();
  if (!classSection?.class_teacher_id) throw new Error("That class has no class teacher assigned yet");

  const { data, error } = await supabase
    .from("ptm_meetings")
    .insert({
      class_section_id: input.classSectionId,
      teacher_id: classSection.class_teacher_id,
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

/**
 * Deletes a meeting and its slots (both cascade). If any slot was booked or
 * had a booking under review, every affected guardian gets a push notice that
 * the meeting was cancelled — deleting isn't blocked on bookings existing,
 * since a school sometimes genuinely needs to cancel a PTM after parents have
 * already reserved a time.
 */
export async function deleteMeeting(meetingId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("ptm_meetings")
    .select("title, meeting_date, class_sections(grade, section)")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) throw new Error("Meeting not found");

  const { data: affectedSlots } = await supabase
    .from("ptm_slots")
    .select("booked_by_guardian_id")
    .eq("meeting_id", meetingId)
    .not("booked_by_guardian_id", "is", null);

  const affectedGuardianIds = [
    ...new Set((affectedSlots ?? []).map((s) => s.booked_by_guardian_id).filter((v): v is string => !!v)),
  ];

  const { error } = await supabase.from("ptm_meetings").delete().eq("id", meetingId);
  if (error) throw new Error(error.message);

  if (affectedGuardianIds.length > 0) {
    const cls = meeting.class_sections as { grade: string; section: string } | null;
    const classLabel = cls ? `Grade ${cls.grade}-${cls.section}` : "your class";
    await sendPush(
      affectedGuardianIds.map((userId) => ({ userId, role: "guardian" as const })),
      {
        title: "PTM cancelled",
        body: `${meeting.title ?? "The parent-teacher meeting"} for ${classLabel} on ${meeting.meeting_date} has been cancelled. Your booked slot no longer applies.`,
        url: "/ptm",
      },
      "ptm"
    );
  }

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
    .is("booked_by_guardian_id", null);

  if (error) throw new Error(error.message);
  revalidatePath(`/console/ptm/${meetingId}`);
}
