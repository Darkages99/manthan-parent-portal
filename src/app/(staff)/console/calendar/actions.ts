"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer, type StaffViewer } from "@/lib/session";
import { parseEventFields, type EventFields } from "@/lib/dtr-input";
import { notifyCalendarEvent } from "@/lib/calendar-notify";
import { logError } from "@/lib/log";

async function requireStaff(): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  return viewer;
}

function revalidateCalendar() {
  revalidatePath("/console/calendar");
  revalidatePath("/console");
  revalidatePath("/dtr");
  revalidatePath("/home");
}

/**
 * Adds a calendar event. No classes and no groups = whole school, which only
 * leadership may do. create_dtr_event() (migration 0054) is the gate: it checks
 * a teacher's classes and groups and writes the event and its targets in one
 * transaction.
 */
export async function createCalendarEvent(
  input: EventFields & { classSectionIds: string[]; groupIds: string[] }
): Promise<string> {
  await requireStaff();
  const fields = parseEventFields(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_dtr_event", {
    p_title: fields.title,
    p_event_date: fields.eventDate,
    p_category: fields.category,
    p_description: fields.description ?? undefined,
    p_class_section_ids: [...new Set(input.classSectionIds)],
    p_group_ids: [...new Set(input.groupIds)],
  });
  if (error) throw new Error(error.message);

  // Best-effort: the event is saved, so a push failure is logged, not thrown.
  try {
    await notifyCalendarEvent({
      ...fields,
      classSectionIds: input.classSectionIds,
      groupIds: input.groupIds,
    });
  } catch (err) {
    logError("[calendar] notify failed", err);
  }

  revalidateCalendar();
  return data;
}

/**
 * Edits an event's title, date, category and description. Who it is for stays
 * as created (only leadership may write the target tables); delete and re-add
 * to change it. RLS lets only the creator and leadership update, so a row
 * count of 0 means the viewer may not edit this event.
 */
export async function updateCalendarEvent(id: string, input: EventFields): Promise<void> {
  await requireStaff();
  const fields = parseEventFields(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dtr_events")
    .update({
      title: fields.title,
      event_date: fields.eventDate,
      category: fields.category,
      description: fields.description,
    })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You can only edit events you added");
  revalidateCalendar();
}

/** Deletes an event (its class and group targets cascade). Creator or leadership only, via RLS. */
export async function deleteCalendarEvent(id: string): Promise<void> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("dtr_events").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You can only delete events you added");
  revalidateCalendar();
}
