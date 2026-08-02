"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";

export async function upsertResult(input: {
  id?: string;
  studentId: string;
  term: string;
  subject: string;
  marks: number;
  maxMarks: number;
  grade: string | null;
}) {
  await requirePrincipal();
  const { id, studentId, term, subject, marks, maxMarks, grade } = input;
  if (!studentId) throw new Error("Student is required");
  if (!term.trim()) throw new Error("Term is required");
  if (!subject.trim()) throw new Error("Subject is required");
  if (!Number.isFinite(marks) || !Number.isFinite(maxMarks)) throw new Error("Marks must be numbers");
  if (maxMarks <= 0) throw new Error("Max marks must be greater than 0");
  if (marks < 0 || marks > maxMarks) throw new Error("Marks must be between 0 and the maximum");

  const supabase = await createClient();
  const row = {
    student_id: studentId,
    term: term.trim(),
    subject: subject.trim(),
    marks,
    max_marks: maxMarks,
    grade: grade?.trim() || null,
  };

  const { error } = id
    ? await supabase.from("exam_results").update(row).eq("id", id)
    : await supabase.from("exam_results").insert(row);

  if (error) throw new Error(error.message);
  revalidatePath("/console/results");
}

export async function deleteResult(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Result is required");

  const supabase = await createClient();
  const { error } = await supabase.from("exam_results").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/results");
}
