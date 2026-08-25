"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";

type StudentInput = {
  firstName: string;
  lastName: string;
  rollNo: string;
  classSectionId: string;
  photoUrl: string;
};

/** Creates a student directly (outside the Sheets sync path) — used by the
 * staff-facing Students section. Class is always required. */
export async function createStudent(input: StudentInput) {
  await requirePrincipal();
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("First and last name are required");
  if (!input.rollNo.trim()) throw new Error("Roll number is required");
  if (!input.classSectionId) throw new Error("Class is required");

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    roll_no: input.rollNo.trim(),
    class_section_id: input.classSectionId,
    photo_url: input.photoUrl.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/console/students");
}

/** Edits an existing student's name, roll number, class or photo. */
export async function updateStudent(id: string, input: StudentInput) {
  await requirePrincipal();
  if (!id) throw new Error("Student is required");
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("First and last name are required");
  if (!input.rollNo.trim()) throw new Error("Roll number is required");
  if (!input.classSectionId) throw new Error("Class is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      roll_no: input.rollNo.trim(),
      class_section_id: input.classSectionId,
      photo_url: input.photoUrl.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/students");
}

/** Deletes a student. Fails with a readable message if other records
 * (attendance, results, ...) still reference them with a restrictive FK. */
export async function deleteStudent(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Student is required");

  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "Can't delete — this student still has linked records (attendance, results, etc.)."
        : error.message
    );
  }
  revalidatePath("/console/students");
}
