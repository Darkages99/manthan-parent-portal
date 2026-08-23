"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";

/** Creates an empty custom group — members are added afterwards via
 * setGroupMembers on the group management screen. */
export async function createGroup(name: string): Promise<string> {
  const viewer = await requirePrincipal();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the group a name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_groups")
    .insert({ name: trimmed, created_by: viewer.staff.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/console/messages/groups");
  return data.id as string;
}

export async function renameGroup(id: string, name: string) {
  await requirePrincipal();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the group a name");

  const supabase = await createClient();
  const { error } = await supabase.from("custom_groups").update({ name: trimmed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/messages/groups");
  revalidatePath("/console/messages");
}

export async function deleteGroup(id: string) {
  await requirePrincipal();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/messages/groups");
  revalidatePath("/console/messages");
}

/** Replaces a group's entire membership with the given student ids. */
export async function setGroupMembers(groupId: string, studentIds: string[]) {
  await requirePrincipal();
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("custom_group_students")
    .delete()
    .eq("custom_group_id", groupId);
  if (deleteError) throw new Error(deleteError.message);

  if (studentIds.length > 0) {
    const rows = [...new Set(studentIds)].map((id) => ({
      custom_group_id: groupId,
      student_id: id,
    }));
    const { error } = await supabase.from("custom_group_students").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/console/messages/groups");
  revalidatePath("/console/messages");
}
