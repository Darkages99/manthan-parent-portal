"use server";

import { revalidatePath, updateTag } from "next/cache";
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
  revalidatePath(`/console/classes/${classSectionId}`);
}

/** Creates a subject if `name` doesn't already match one, and returns its id
 * either way — backs the class detail page's combined subject picker. */
export async function findOrCreateSubject(name: string): Promise<string> {
  await requirePrincipal();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Subject name is required");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("subjects")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  updateTag("subjects");
  return data.id;
}

/** Assigns a teacher to teach a subject in a class. */
export async function addClassSubjectTeacher(input: {
  classSectionId: string;
  subjectId: string;
  teacherId: string;
}) {
  await requirePrincipal();
  const { classSectionId, subjectId, teacherId } = input;
  if (!classSectionId || !subjectId || !teacherId) {
    throw new Error("Class, subject and teacher are all required");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_subject_teachers")
    .insert({ class_section_id: classSectionId, subject_id: subjectId, teacher_id: teacherId });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath(`/console/classes/${classSectionId}`);
}

/** Removes a subject-teacher assignment from a class. */
export async function removeClassSubjectTeacher(id: string, classSectionId: string) {
  await requirePrincipal();
  const supabase = await createClient();
  const { error } = await supabase.from("class_subject_teachers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/console/classes/${classSectionId}`);
}

/** Copies a teacher's subject assignment onto another class — used by the
 * class detail page's drag-and-drop. Does not remove the source assignment. */
export async function copyTeacherToClass(classSubjectTeacherId: string, targetClassSectionId: string) {
  await requirePrincipal();
  if (!classSubjectTeacherId || !targetClassSectionId) throw new Error("Missing teacher or target class");

  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("class_subject_teachers")
    .select("class_section_id, subject_id, teacher_id")
    .eq("id", classSubjectTeacherId)
    .single();
  if (sourceError || !source) throw new Error("Assignment not found");

  const { error } = await supabase.from("class_subject_teachers").insert({
    class_section_id: targetClassSectionId,
    subject_id: source.subject_id,
    teacher_id: source.teacher_id,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath(`/console/classes/${source.class_section_id}`);
  revalidatePath(`/console/classes/${targetClassSectionId}`);
}

/** Moves a student to another class — used by the class detail page's
 * drag-and-drop. Removes them from their current class (single FK). */
export async function moveStudentToClass(studentId: string, targetClassSectionId: string) {
  await requirePrincipal();
  if (!studentId || !targetClassSectionId) throw new Error("Missing student or target class");

  const supabase = await createClient();
  const { data: student, error: fetchError } = await supabase
    .from("students")
    .select("class_section_id")
    .eq("id", studentId)
    .single();
  if (fetchError || !student) throw new Error("Student not found");
  const sourceClassSectionId = student.class_section_id;

  const { error } = await supabase
    .from("students")
    .update({ class_section_id: targetClassSectionId })
    .eq("id", studentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/console/classes/${sourceClassSectionId}`);
  revalidatePath(`/console/classes/${targetClassSectionId}`);
}
