"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";
import type { Tables } from "@/lib/supabase/database.types";

export type CompetitionInput = {
  name: string;
  description: string;
  examDate: string;
  registrationDeadline: string;
  externalLink: string;
};

/** Revalidate both the staff console list and the parent-facing read-only page. */
function revalidateCompetitions() {
  revalidatePath("/console/competitions");
  revalidatePath("/competitions");
}

/** Adds a new competition / olympiad listing. */
export async function createCompetition(
  input: CompetitionInput
): Promise<Tables<"competitions">> {
  const viewer = await requirePrincipal();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .insert({
      name,
      description: input.description.trim() || null,
      exam_date: input.examDate || null,
      registration_deadline: input.registrationDeadline || null,
      external_link: input.externalLink.trim() || null,
      created_by: viewer.staff.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateCompetitions();
  return data;
}

/** Edits an existing competition listing. */
export async function updateCompetition(
  id: string,
  input: CompetitionInput
): Promise<Tables<"competitions">> {
  await requirePrincipal();
  if (!id) throw new Error("Competition is required");
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .update({
      name,
      description: input.description.trim() || null,
      exam_date: input.examDate || null,
      registration_deadline: input.registrationDeadline || null,
      external_link: input.externalLink.trim() || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateCompetitions();
  return data;
}

/** Removes a competition listing. */
export async function deleteCompetition(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Competition is required");

  const supabase = await createClient();
  const { error } = await supabase.from("competitions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateCompetitions();
}
