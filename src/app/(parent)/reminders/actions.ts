"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function createReminder(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const message = String(formData.get("message") ?? "").trim();
  const remindAtLocal = String(formData.get("remindAt") ?? "").trim();

  if (!message || !remindAtLocal) throw new Error("All fields are required");

  // <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" with no timezone.
  // The portal displays all other times in IST (see formatSlotTime), so treat
  // this as IST wall-clock time when converting to a UTC timestamptz.
  const remindAt = new Date(`${remindAtLocal}:00+05:30`);
  if (Number.isNaN(remindAt.getTime())) throw new Error("Invalid date/time");

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({
    guardian_id: viewer.guardian.id,
    message,
    remind_at: remindAt.toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/reminders");
}

export async function cancelReminder(reminderId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("guardian_id", viewer.guardian.id);

  if (error) throw new Error(error.message);
  revalidatePath("/reminders");
}
