// Pure, framework-free — shared by the console's pending-deletions list (client
// component) and the Sheets sync job (server-only), so both describe a queued
// deletion identically instead of drifting apart.

export const PENDING_DELETION_SUBJECT_LABEL: Record<string, string> = {
  students: "Student",
  guardians: "Guardian",
  staff: "Teacher / staff",
  class_sections: "Class section",
  subjects: "Subject",
  timetable_entries: "Timetable entry",
};

/** Best-effort human label pulled out of a pending deletion's last known row values. */
export function pendingDeletionLabel(subjectId: string, snapshot: unknown): string {
  const snap = snapshot as Record<string, unknown> | null;
  if (!snap) return subjectId;
  if (typeof snap.first_name === "string" || typeof snap.last_name === "string") {
    return [snap.first_name, snap.last_name].filter(Boolean).join(" ") || subjectId;
  }
  if (typeof snap.name === "string") return snap.name;
  if (typeof snap.grade === "string" && typeof snap.section === "string") {
    return `Grade ${snap.grade} - ${snap.section}`;
  }
  return subjectId;
}
