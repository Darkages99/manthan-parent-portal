"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";

/** Assigns (or clears, when staffId is null) the class teacher for a section. */
export async function assignClassTeacher(classSectionId: string, staffId: string | null) {
  await requirePrincipal();
  if (!classSectionId) throw new Error("Class is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_sections")
    .update({ class_teacher_id: staffId })
    .eq("id", classSectionId);

  if (error) throw new Error(error.message);
  revalidatePath("/console/classes");
}
