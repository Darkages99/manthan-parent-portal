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
 * staff-facing Students section. Class is always required, and a student must
 * have at least one parent (enforced in the DB too). The student and its
 * guardian links are inserted atomically via an RPC so the deferred integrity
 * triggers see the final state. */
export async function createStudent(input: StudentInput, guardianIds: string[]) {
  await requirePrincipal();
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("First and last name are required");
  if (!input.rollNo.trim()) throw new Error("Roll number is required");
  if (!input.classSectionId) throw new Error("Class is required");
  const parentIds = [...new Set(guardianIds ?? [])].filter(Boolean);
  if (parentIds.length === 0) throw new Error("A student must have at least one parent");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_student_with_guardians", {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_roll_no: input.rollNo.trim(),
    p_class_section_id: input.classSectionId,
    p_guardian_ids: parentIds,
    p_photo_url: input.photoUrl.trim() || undefined,
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
