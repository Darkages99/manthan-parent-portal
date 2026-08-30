"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCanEditGradeConfig } from "@/lib/results-scope";
import { getSubjectGradingConfig, type GradeBand } from "@/lib/grade-boundaries";
import { upsertResult } from "../actions";

/**
 * Replaces a subject+term's max marks and grade bands in one save (the
 * config editor always submits the full set — there's no partial update of
 * individual bands). Bands are deleted and reinserted rather than diffed,
 * since there's rarely more than a handful and the editor already re-renders
 * the whole list.
 */
export async function saveGradeConfig(input: {
  subject: string;
  term: string;
  maxMarks: number;
  bands: GradeBand[];
}) {
  const subject = input.subject.trim();
  const term = input.term.trim();
  if (!subject) throw new Error("Subject is required");
  if (!term) throw new Error("Term is required");
  if (!Number.isFinite(input.maxMarks) || input.maxMarks <= 0) {
    throw new Error("Max marks must be greater than 0");
  }
  for (const b of input.bands) {
    if (!b.grade.trim()) throw new Error("Every band needs a grade");
    if (!Number.isFinite(b.minPct) || !Number.isFinite(b.maxPct)) {
      throw new Error(`${b.grade}: percentages must be numbers`);
    }
    if (b.minPct < 0 || b.maxPct > 100 || b.minPct > b.maxPct) {
      throw new Error(`${b.grade}: range must be within 0–100 and min ≤ max`);
    }
  }
  await assertCanEditGradeConfig(subject);

  const supabase = await createClient();

  const { error: configError } = await supabase
    .from("subject_grading_config")
    .upsert({ subject, term, max_marks: input.maxMarks, updated_at: new Date().toISOString() }, { onConflict: "subject,term" });
  if (configError) throw new Error(configError.message);

  const { error: deleteError } = await supabase
    .from("grade_boundaries")
    .delete()
    .eq("subject", subject)
    .eq("term", term);
  if (deleteError) throw new Error(deleteError.message);

  if (input.bands.length > 0) {
    const { error: insertError } = await supabase.from("grade_boundaries").insert(
      input.bands.map((b) => ({
        subject,
        term,
        grade: b.grade.trim(),
        min_pct: b.minPct,
        max_pct: b.maxPct,
      }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/console/results/subject");
  revalidatePath("/console/results");
}

/**
 * Saves one student's mark from the subject-focused entry table — max marks
 * comes from that subject+term's configured grading scheme (default 100 if
 * unconfigured) rather than being typed per row, and grade is left for
 * upsertResult to auto-fill from the configured bands.
 */
export async function saveSubjectMark(input: {
  resultId?: string;
  studentId: string;
  term: string;
  subject: string;
  marks: number;
}) {
  const supabase = await createClient();
  const config = await getSubjectGradingConfig(supabase, input.subject.trim(), input.term.trim());
  await upsertResult({
    id: input.resultId,
    studentId: input.studentId,
    term: input.term,
    subject: input.subject,
    marks: input.marks,
    maxMarks: config.maxMarks,
    grade: null,
  });
}
