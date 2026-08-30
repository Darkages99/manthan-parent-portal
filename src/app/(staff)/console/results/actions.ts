"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import {
  assertCanEditMark,
  assertCanManageReportCard,
  canEditSubject,
  getEditableSubjectsByClass,
} from "@/lib/results-scope";
import { sendPush } from "@/lib/notifications/push";
import { computeClassAnalytics, FAIL_THRESHOLD_PCT, WEAK_THRESHOLD_PCT } from "@/lib/results-analytics";
import { parseCsv } from "@/lib/csv";

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
  const { id, studentId, term, subject, marks, maxMarks, grade } = input;
  if (!studentId) throw new Error("Student is required");
  if (!term.trim()) throw new Error("Term is required");
  if (!subject.trim()) throw new Error("Subject is required");
  if (!Number.isFinite(marks) || !Number.isFinite(maxMarks)) throw new Error("Marks must be numbers");
  if (maxMarks <= 0) throw new Error("Max marks must be greater than 0");
  if (marks < 0 || marks > maxMarks) throw new Error("Marks must be between 0 and the maximum");
  await assertCanEditMark(studentId, subject.trim());

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

/** Unpublishes a student's report card PDF for a term (clears the URL from
 * every exam_results row for that student+term — see the upload route for
 * why the URL is denormalized across subject rows). */
export async function removeReportCard(studentId: string, term: string) {
  if (!studentId || !term) throw new Error("Student and term are required");
  await assertCanManageReportCard(studentId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("exam_results")
    .update({ report_card_pdf_url: null })
    .eq("student_id", studentId)
    .eq("term", term);
  if (error) throw new Error(error.message);
  revalidatePath("/console/results");
}

export async function deleteResult(id: string) {
  if (!id) throw new Error("Result is required");

  const supabase = await createClient();
  const { data: result } = await supabase
    .from("exam_results")
    .select("student_id, subject")
    .eq("id", id)
    .maybeSingle();
  if (!result) throw new Error("Mark not found");
  await assertCanEditMark(result.student_id, result.subject);

  const { error } = await supabase.from("exam_results").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/results");
}

export type MarksImportResult = { imported: number; errors: { row: number; message: string }[] };

/**
 * Bulk-enters marks for one class + term from a CSV: roll_no, subject, marks,
 * max_marks (optional, default 100), grade (optional). Roll numbers are
 * resolved only within `classId` — never school-wide — since roll_no isn't
 * unique across classes (see bulkSendByRollNumber's own note on this in
 * console/messages/compose/actions.ts). A class_teacher is restricted to the
 * subjects getEditableSubjectsByClass grants them for this class; principal-
 * tier can enter any subject. Bad rows are collected as errors rather than
 * aborting the whole import, mirroring bulkSendByRollNumber/importTimetableCsv.
 */
export async function importMarksCsv(
  classId: string,
  term: string,
  csvText: string
): Promise<MarksImportResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  const isPrincipal = isPrincipalRole(viewer.staff.role);
  if (!classId) throw new Error("Class is required");
  if (!term.trim()) throw new Error("Term is required");

  const supabase = await createClient();

  let subjectScope: Set<string> | "all" | undefined;
  if (!isPrincipal) {
    if (viewer.staff.role !== "class_teacher") throw new Error("Not authorized to enter marks");
    const taughtClassIds = await getTaughtClassIds(supabase, viewer.staff.id);
    if (!taughtClassIds.includes(classId)) throw new Error("Not your class");
    const scopeByClass = await getEditableSubjectsByClass(supabase, viewer.staff.id);
    subjectScope = scopeByClass.get(classId);
    if (!subjectScope) throw new Error("Not authorized to enter marks for this class");
  }

  const { header, rows } = parseCsv(csvText);
  const norm = (h: string) => h.toLowerCase().replace(/[\s_]/g, "");
  const rollIdx = header.findIndex((h) => norm(h) === "rollno");
  const subjectIdx = header.findIndex((h) => norm(h) === "subject");
  const marksIdx = header.findIndex((h) => norm(h) === "marks");
  const maxMarksIdx = header.findIndex((h) => norm(h) === "maxmarks");
  const gradeIdx = header.findIndex((h) => norm(h) === "grade");
  if (rollIdx === -1 || subjectIdx === -1 || marksIdx === -1) {
    throw new Error("CSV must have roll_no, subject and marks columns");
  }

  const parsedRows = rows.map((r, i) => ({
    row: i + 2, // +1 for 0-index, +1 for the header row
    rollNo: (r[rollIdx] ?? "").trim(),
    subject: (r[subjectIdx] ?? "").trim(),
    marksStr: (r[marksIdx] ?? "").trim(),
    maxMarksStr: maxMarksIdx === -1 ? "" : (r[maxMarksIdx] ?? "").trim(),
    grade: gradeIdx === -1 ? "" : (r[gradeIdx] ?? "").trim(),
  }));

  const { data: classStudents } = await supabase
    .from("students")
    .select("id, roll_no")
    .eq("class_section_id", classId);
  const studentIdByRoll = new Map((classStudents ?? []).map((s) => [s.roll_no, s.id]));
  const studentIds = [...studentIdByRoll.values()];

  const { data: existingResults } = studentIds.length
    ? await supabase
        .from("exam_results")
        .select("id, student_id, subject")
        .in("student_id", studentIds)
        .eq("term", term.trim())
    : { data: [] as { id: string; student_id: string; subject: string }[] };
  const existingIdByKey = new Map((existingResults ?? []).map((r) => [`${r.student_id}|${r.subject}`, r.id]));

  const errors: { row: number; message: string }[] = [];
  let imported = 0;

  for (const r of parsedRows) {
    if (!r.rollNo || !r.subject || !r.marksStr) {
      errors.push({ row: r.row, message: "Missing roll number, subject, or marks" });
      continue;
    }
    const studentId = studentIdByRoll.get(r.rollNo);
    if (!studentId) {
      errors.push({ row: r.row, message: `Roll number ${r.rollNo} not found in this class` });
      continue;
    }
    if (!isPrincipal && !canEditSubject(subjectScope, r.subject)) {
      errors.push({ row: r.row, message: `You don't have permission to enter ${r.subject} marks` });
      continue;
    }
    const marks = Number(r.marksStr);
    const maxMarks = r.maxMarksStr ? Number(r.maxMarksStr) : 100;
    if (!Number.isFinite(marks) || !Number.isFinite(maxMarks)) {
      errors.push({ row: r.row, message: "Marks must be numbers" });
      continue;
    }
    if (maxMarks <= 0) {
      errors.push({ row: r.row, message: "Max marks must be greater than 0" });
      continue;
    }
    if (marks < 0 || marks > maxMarks) {
      errors.push({ row: r.row, message: "Marks must be between 0 and the maximum" });
      continue;
    }

    const row = {
      student_id: studentId,
      term: term.trim(),
      subject: r.subject,
      marks,
      max_marks: maxMarks,
      grade: r.grade || null,
    };
    const existingId = existingIdByKey.get(`${studentId}|${r.subject}`);
    const { error } = existingId
      ? await supabase.from("exam_results").update(row).eq("id", existingId)
      : await supabase.from("exam_results").insert(row);
    if (error) {
      errors.push({ row: r.row, message: error.message });
      continue;
    }
    imported += 1;
  }

  revalidatePath("/console/results");
  return { imported, errors };
}
