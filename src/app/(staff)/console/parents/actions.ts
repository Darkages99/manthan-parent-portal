"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";

type GuardianInput = {
  name: string;
  relation: string;
  phone: string;
  email: string;
};

/** Creates a guardian and links their children (existing students). The
 * email set here is what gates self-serve account activation — see
 * activateGuardianAccount in src/app/activate/actions.ts. */
export async function createGuardian(input: GuardianInput, childStudentIds: string[]) {
  await requirePrincipal();
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.phone.trim()) throw new Error("Mobile number is required");
  if (!input.email.trim()) throw new Error("Email is required");

  const supabase = await createClient();
  const { data: guardian, error } = await supabase
    .from("guardians")
    .insert({
      name: input.name.trim(),
      relation: input.relation.trim() || "Guardian",
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
    })
    .select("id")
    .single();
  if (error || !guardian) throw new Error(error?.message ?? "Couldn't create guardian");

  if (childStudentIds.length) {
    const { error: linkError } = await supabase
      .from("guardian_student")
      .insert(childStudentIds.map((student_id) => ({ guardian_id: guardian.id, student_id })));
    if (linkError) throw new Error(linkError.message);
  }
  revalidatePath("/console/parents");
}

/** Edits a guardian's details and replaces their full set of linked children. */
export async function updateGuardian(id: string, input: GuardianInput, childStudentIds: string[]) {
  await requirePrincipal();
  if (!id) throw new Error("Guardian is required");
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.phone.trim()) throw new Error("Mobile number is required");
  if (!input.email.trim()) throw new Error("Email is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("guardians")
    .update({
      name: input.name.trim(),
      relation: input.relation.trim() || "Guardian",
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: clearError } = await supabase.from("guardian_student").delete().eq("guardian_id", id);
  if (clearError) throw new Error(clearError.message);
  if (childStudentIds.length) {
    const { error: linkError } = await supabase
      .from("guardian_student")
      .insert(childStudentIds.map((student_id) => ({ guardian_id: id, student_id })));
    if (linkError) throw new Error(linkError.message);
  }
  revalidatePath("/console/parents");
}

/** Deletes a guardian. Child links are removed automatically (cascade); this
 * also unlinks their Supabase Auth account (deleted separately, if any). */
export async function deleteGuardian(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Guardian is required");

  const supabase = await createClient();
  const { error } = await supabase.from("guardians").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/parents");
}
