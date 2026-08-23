"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";
import { sendPush } from "@/lib/notifications/push";
import { computeClassAnalytics, FAIL_THRESHOLD_PCT, WEAK_THRESHOLD_PCT } from "@/lib/results-analytics";

/**
 * After a mark is saved, recomputes that student's class + term standing and
 * nudges every principal-tier staff member if the class average (or any
 * subject's class average) has dropped below WEAK_THRESHOLD_PCT, or this
 * result itself is a fail (<FAIL_THRESHOLD_PCT). Best-effort — a failure here
 * never blocks the save.
 */
async function alertIfWeak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  term: string,
  marks: number,
  maxMarks: number,
  subject: string
) {
  try {
    const { data: student } = await supabase
      .from("students")
      .select("first_name, last_name, class_section_id")
      .eq("id", studentId)
      .single();
    if (!student) return;

    const { data: classSection } = await supabase
      .from("class_sections")
      .select("grade, section")
      .eq("id", student.class_section_id)
      .single();
    const classLabel = classSection ? `Grade ${classSection.grade}-${classSection.section}` : "a class";

    const pct = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;
    const alerts: string[] = [];
    if (pct < FAIL_THRESHOLD_PCT) {
      alerts.push(
        `${student.first_name} ${student.last_name} (${classLabel}) scored ${pct.toFixed(0)}% in ${subject} — below ${FAIL_THRESHOLD_PCT}%.`
      );
    }

    const { data: classStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("class_section_id", student.class_section_id);
    const classStudentIds = (classStudents ?? []).map((s) => s.id);
    const { data: classResults } = classStudentIds.length
      ? await supabase
          .from("exam_results")
          .select("student_id, term, subject, marks, max_marks")
          .in("student_id", classStudentIds)
          .eq("term", term)
      : { data: [] as { student_id: string; term: string; subject: string; marks: number; max_marks: number }[] };
    const analytics = computeClassAnalytics(classResults ?? [], classStudents ?? [], term);

    if (analytics.classAveragePct < WEAK_THRESHOLD_PCT) {
      alerts.push(
        `${classLabel}'s ${term} average is ${analytics.classAveragePct.toFixed(1)}% — below ${WEAK_THRESHOLD_PCT}%.`
      );
    }
    const weakSubject = analytics.subjectAverages.find((s) => s.percentage < WEAK_THRESHOLD_PCT);
    if (weakSubject) {
      alerts.push(
        `${classLabel}'s ${term} average in ${weakSubject.subject} is ${weakSubject.percentage.toFixed(1)}% — below ${WEAK_THRESHOLD_PCT}%.`
      );
    }
    if (alerts.length === 0) return;

    const { data: principals } = await supabase
      .from("staff")
      .select("id")
      .in("role", ["principal", "super_admin", "coordinator"])
      .eq("active", true);
    if (!principals || principals.length === 0) return;

    await sendPush(
      principals.map((p) => ({ userId: p.id, role: "staff" as const })),
      { title: "Results need attention", body: alerts[0], url: "/console/results/classes" },
      "defaulters"
    );
  } catch (e) {
    console.error("[results] weak-result alert failed:", e);
  }
}

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
  await alertIfWeak(supabase, studentId, row.term, marks, maxMarks, row.subject);
}

export async function deleteResult(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Result is required");

  const supabase = await createClient();
  const { error } = await supabase.from("exam_results").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/results");
}
