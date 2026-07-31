"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function bookSlot(slotId: string, studentId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");
  if (!viewer.students.some((s) => s.id === studentId)) throw new Error("Not your child");

  const supabase = await createClient();
  // Only claim the slot if it's still open — guards against a double-book race.
  const { data, error } = await supabase
    .from("ptm_slots")
    .update({ booked_by_guardian_id: viewer.guardian.id, booked_student_id: studentId })
    .eq("id", slotId)
    .is("booked_by_guardian_id", null)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("That slot was just taken — pick another.");
  revalidatePath("/ptm");
}

export async function cancelSlot(slotId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ptm_slots")
    .update({ booked_by_guardian_id: null, booked_student_id: null })
    .eq("id", slotId)
    .eq("booked_by_guardian_id", viewer.guardian.id);

  if (error) throw new Error(error.message);
  revalidatePath("/ptm");
}
