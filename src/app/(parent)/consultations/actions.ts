"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

/** Tuesday = 2, Thursday = 4 (JS Date#getDay()). */
const ALLOWED_WEEKDAYS = new Set([2, 4]);

function isTuesdayOrThursday(dateStr: string): boolean {
  // Parse as a local calendar date (not UTC) so "2026-09-01" checks the
  // weekday it actually is on the calendar, not shifted by timezone.
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return ALLOWED_WEEKDAYS.has(day);
}

export async function requestConsultation(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const studentId = String(formData.get("studentId"));
  const preferredDate = String(formData.get("preferredDate"));
  const availabilityNote = String(formData.get("availabilityNote"));

  if (!studentId || !preferredDate || !availabilityNote.trim()) {
    throw new Error("All fields are required");
  }
  if (!viewer.students.some((s) => s.id === studentId)) throw new Error("Not your child");
  if (!isTuesdayOrThursday(preferredDate)) {
    throw new Error("Consultations are only available on Tuesdays and Thursdays");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("parent_consultations").insert({
    student_id: studentId,
    requested_by: viewer.guardian.id,
    preferred_date: preferredDate,
    availability_note: availabilityNote.trim(),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/consultations");
}

export async function cancelConsultation(id: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const supabase = await createClient();
  const { data: consultation } = await supabase
    .from("parent_consultations")
    .select("requested_by")
    .eq("id", id)
    .single();
  if (!consultation || consultation.requested_by !== viewer.guardian.id) {
    throw new Error("That isn't your request");
  }

  const { error } = await supabase.from("parent_consultations").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/consultations");
}
