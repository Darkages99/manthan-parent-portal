import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type ClassLite = { grade: string; section: string } | null;
type SubjectLite = { name: string } | null;

/** Finds every class/subject assignment a staff member held — used to raise
 * one alert per assignment when they're deactivated, so the principal knows
 * what needs reassigning. */
export async function alertsForDeactivatedStaff(
  supabase: SupabaseClient<Database>,
  staffId: string
): Promise<string[]> {
  const [{ data: classTeacherOf }, { data: subjectAssignments }, { data: timetableEntries }] =
    await Promise.all([
      supabase.from("class_sections").select("grade, section").eq("class_teacher_id", staffId),
      supabase
        .from("class_subject_teachers")
        .select("class_section_id, subject_id, class_sections(grade, section), subjects(name)")
        .eq("teacher_id", staffId),
      supabase
        .from("timetable_entries")
        .select("class_section_id, subject_id, class_sections(grade, section), subjects(name)")
        .eq("teacher_id", staffId),
    ]);

  const messages: string[] = [];
  for (const c of classTeacherOf ?? []) {
    messages.push(`Grade ${c.grade}-${c.section} needs a new class teacher`);
  }

  const seen = new Set<string>();
  for (const a of subjectAssignments ?? []) {
    const key = `${a.class_section_id}:${a.subject_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = a.class_sections as unknown as ClassLite;
    const subj = a.subjects as unknown as SubjectLite;
    if (cls && subj) messages.push(`Grade ${cls.grade}-${cls.section} needs a ${subj.name} teacher`);
  }
  for (const e of timetableEntries ?? []) {
    if (!e.subject_id) continue;
    const key = `${e.class_section_id}:${e.subject_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = e.class_sections as unknown as ClassLite;
    const subj = e.subjects as unknown as SubjectLite;
    if (cls && subj) messages.push(`Grade ${cls.grade}-${cls.section} timetable needs a ${subj.name} teacher`);
  }

  return messages;
}

export async function insertStaffAlerts(
  supabase: SupabaseClient<Database>,
  staffId: string,
  messages: string[]
) {
  const rows = messages.map((message) => ({ staff_id: staffId, message }));
  const { error } = await supabase.from("staff_reassignment_alerts").insert(rows);
  if (error) throw new Error(error.message);
}
