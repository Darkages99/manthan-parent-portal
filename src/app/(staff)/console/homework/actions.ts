"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

type HomeworkInput = {
  classSectionId: string;
  subjectId: string | null;
  title: string;
  description: string;
  dueDate: string;
};

/** Resolves the signed-in staff member and, for class teachers, the set of
 * class_section ids they're allowed to touch (their own class(es)). Other
 * staff roles (principal, super_admin, front_office, ...) get `null`, meaning
 * unrestricted — matching the class-scoping idiom used by console/attendance. */
async function scopedStaff(): Promise<{ staffId: string; classIds: string[] | null }> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  if (viewer.staff.role !== "class_teacher") {
    return { staffId: viewer.staff.id, classIds: null };
  }

  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("class_sections")
    .select("id")
    .eq("class_teacher_id", viewer.staff.id);
  return { staffId: viewer.staff.id, classIds: (classes ?? []).map((c) => c.id) };
}

function assertClassAllowed(classIds: string[] | null, classSectionId: string) {
  if (classIds && !classIds.includes(classSectionId)) {
    throw new Error("You can only set homework for your own class");
  }
}

/** Creates a homework assignment for a class + subject. */
export async function createHomework(input: HomeworkInput) {
  const { staffId, classIds } = await scopedStaff();
  if (!input.classSectionId) throw new Error("Class is required");
  if (!input.title.trim()) throw new Error("Title is required");
  if (!input.dueDate) throw new Error("Due date is required");
  assertClassAllowed(classIds, input.classSectionId);

  const supabase = await createClient();
  const { error } = await supabase.from("homework_assignments").insert({
    class_section_id: input.classSectionId,
    subject_id: input.subjectId || null,
    teacher_id: staffId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    due_date: input.dueDate,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/console/homework");
}

/** Updates an existing homework assignment. Class teachers may only edit
 * assignments that belong (both before and after the edit) to their own class. */
export async function updateHomework(id: string, input: HomeworkInput) {
  const { classIds } = await scopedStaff();
  if (!id) throw new Error("Assignment is required");
  if (!input.classSectionId) throw new Error("Class is required");
  if (!input.title.trim()) throw new Error("Title is required");
  if (!input.dueDate) throw new Error("Due date is required");

  const supabase = await createClient();

  if (classIds) {
    const { data: existing } = await supabase
      .from("homework_assignments")
      .select("class_section_id")
      .eq("id", id)
      .single();
    if (!existing || !classIds.includes(existing.class_section_id)) {
      throw new Error("You can only edit homework for your own class");
    }
  }
  assertClassAllowed(classIds, input.classSectionId);

  const { error } = await supabase
    .from("homework_assignments")
    .update({
      class_section_id: input.classSectionId,
      subject_id: input.subjectId || null,
      title: input.title.trim(),
      description: input.description.trim() || null,
      due_date: input.dueDate,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/console/homework");
}

/** Deletes a homework assignment. Class teachers may only delete their own class's. */
export async function deleteHomework(id: string) {
  const { classIds } = await scopedStaff();
  if (!id) throw new Error("Assignment is required");

  const supabase = await createClient();

  if (classIds) {
    const { data: existing } = await supabase
      .from("homework_assignments")
      .select("class_section_id")
      .eq("id", id)
      .single();
    if (!existing || !classIds.includes(existing.class_section_id)) {
      throw new Error("You can only delete homework for your own class");
    }
  }

  const { error } = await supabase.from("homework_assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/homework");
}
