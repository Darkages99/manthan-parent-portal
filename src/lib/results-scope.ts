import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getViewer, type StaffViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/** "all" for a class_teacher's own homeroom; otherwise the specific subject
 * name(s) they're assigned in that class via the timetable or
 * class_subject_teachers. */
export type SubjectScope = "all" | Set<string>;

/**
 * Per-class marks-editing scope for a class_teacher-role staff member: their
 * own homeroom class grants every subject, while a class they only
 * subject-teach (timetable or class_subject_teachers) grants just that
 * subject. Used to gate mark entry — narrower than getTaughtClassIds, which
 * only answers "can view", not "which subjects can be edited".
 */
export async function getEditableSubjectsByClass(
  supabase: SupabaseClient<Database>,
  staffId: string
): Promise<Map<string, SubjectScope>> {
  const [{ data: owned }, { data: taught }, { data: assigned }, { data: subjects }] = await Promise.all([
    supabase.from("class_sections").select("id").eq("class_teacher_id", staffId),
    supabase.from("timetable_entries").select("class_section_id, subject_id").eq("teacher_id", staffId),
    supabase.from("class_subject_teachers").select("class_section_id, subject_id").eq("teacher_id", staffId),
    supabase.from("subjects").select("id, name"),
  ]);
  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  const map = new Map<string, SubjectScope>();
  for (const c of owned ?? []) map.set(c.id, "all");
  for (const t of [...(taught ?? []), ...(assigned ?? [])]) {
    if (!t.subject_id) continue;
    const name = subjectNameById.get(t.subject_id);
    if (!name) continue;
    const existing = map.get(t.class_section_id);
    if (existing === "all") continue;
    const set = existing instanceof Set ? existing : new Set<string>();
    set.add(name);
    map.set(t.class_section_id, set);
  }
  return map;
}

export function canEditSubject(scope: SubjectScope | undefined, subject: string): boolean {
  if (!scope) return false;
  if (scope === "all") return true;
  return scope.has(subject);
}

/**
 * Flattens getEditableSubjectsByClass across every class a teacher touches,
 * for scope checks that aren't tied to one class — e.g. subject-level grade
 * boundaries, which apply across every class taking that subject. "all" if
 * they own any homeroom (a homeroom teacher can enter any subject for their
 * own class, so they're trusted to configure any subject's grading scheme).
 */
export async function getEditableSubjects(
  supabase: SupabaseClient<Database>,
  staffId: string
): Promise<SubjectScope> {
  const scopeByClass = await getEditableSubjectsByClass(supabase, staffId);
  const union = new Set<string>();
  for (const scope of scopeByClass.values()) {
    if (scope === "all") return "all";
    for (const s of scope) union.add(s);
  }
  return union;
}

/**
 * Guards a grade-boundaries/max-marks config save for one subject+term.
 * Principal-tier passes unconditionally; a class_teacher passes only if
 * getEditableSubjects grants them this subject somewhere.
 */
export async function assertCanEditGradeConfig(subject: string): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (isPrincipalRole(viewer.staff.role)) return viewer;
  if (viewer.staff.role !== "class_teacher") throw new Error("Not authorized to configure grading");

  const supabase = await createClient();
  const scope = await getEditableSubjects(supabase, viewer.staff.id);
  if (!canEditSubject(scope, subject)) {
    throw new Error(`You don't have permission to configure ${subject} grading`);
  }
  return viewer;
}

/**
 * Guards a mark-entry action (add/edit/delete a single exam_results row).
 * Principal-tier passes unconditionally; a class_teacher passes only if the
 * student's class + this subject fall within getEditableSubjectsByClass.
 * Throws otherwise — call before writing.
 */
export async function assertCanEditMark(studentId: string, subject: string): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (isPrincipalRole(viewer.staff.role)) return viewer;
  if (viewer.staff.role !== "class_teacher") throw new Error("Not authorized to enter marks");

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("class_section_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) throw new Error("Student not found");

  const scopeByClass = await getEditableSubjectsByClass(supabase, viewer.staff.id);
  if (!canEditSubject(scopeByClass.get(student.class_section_id), subject)) {
    throw new Error(`You don't have permission to enter ${subject} marks for this student`);
  }
  return viewer;
}

/**
 * Guards report-card management (upload/replace/remove) — class-level only,
 * since a report card isn't tied to one subject. Principal-tier and
 * front_office pass unconditionally; a class_teacher passes if the student's
 * class is one they teach (getTaughtClassIds).
 */
export async function assertCanManageReportCard(studentId: string): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (isPrincipalRole(viewer.staff.role) || viewer.staff.role === "front_office") return viewer;
  if (viewer.staff.role !== "class_teacher") throw new Error("Not authorized to manage report cards");

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("class_section_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) throw new Error("Student not found");

  const taughtClassIds = await getTaughtClassIds(supabase, viewer.staff.id);
  if (!taughtClassIds.includes(student.class_section_id)) {
    throw new Error("Not authorized to manage this student's report card");
  }
  return viewer;
}
