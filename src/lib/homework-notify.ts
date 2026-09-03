import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";
import { logError } from "@/lib/log";

/** Yesterday's date in IST as YYYY-MM-DD — homework whose due date just passed. */
function yesterdayIst(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Notifies guardians of every student still not-done on homework whose due
 * date passed yesterday, then records it in homework_notifications so the
 * next cron run doesn't repeat it. Run daily from /api/cron/tick.
 *
 * A student is "not done" relative to the assignment's `checked` default
 * (see migration 0036): when checked=false (the initial default) a student
 * is not-done unless they have a homework_submissions row (an override
 * marking them done); when checked=true everyone's done unless they have a
 * row (an override marking them not done). */
export async function notifyUnsubmittedHomework(): Promise<{ notified: number }> {
  const admin = createAdminClient();
  const dueDate = yesterdayIst();

  const { data: assignments } = await admin
    .from("homework_assignments")
    .select("id, title, class_section_id, checked")
    .eq("due_date", dueDate);
  if (!assignments || assignments.length === 0) return { notified: 0 };

  const homeworkIds = assignments.map((a) => a.id);
  const classSectionIds = [...new Set(assignments.map((a) => a.class_section_id))];
  const [{ data: overrides }, { data: roster }, { data: alreadyNotified }] = await Promise.all([
    admin.from("homework_submissions").select("homework_id, student_id").in("homework_id", homeworkIds),
    admin.from("students").select("id, class_section_id").in("class_section_id", classSectionIds),
    admin.from("homework_notifications").select("homework_id, student_id").in("homework_id", homeworkIds),
  ]);

  const overriddenByHomework = new Map<string, Set<string>>();
  for (const o of overrides ?? []) {
    const set = overriddenByHomework.get(o.homework_id) ?? new Set<string>();
    set.add(o.student_id);
    overriddenByHomework.set(o.homework_id, set);
  }
  const notifiedByHomework = new Map<string, Set<string>>();
  for (const n of alreadyNotified ?? []) {
    const set = notifiedByHomework.get(n.homework_id) ?? new Set<string>();
    set.add(n.student_id);
    notifiedByHomework.set(n.homework_id, set);
  }
  const studentsByClass = new Map<string, string[]>();
  for (const s of roster ?? []) {
    const arr = studentsByClass.get(s.class_section_id) ?? [];
    arr.push(s.id);
    studentsByClass.set(s.class_section_id, arr);
  }

  const pending: { homeworkId: string; studentId: string }[] = [];
  for (const a of assignments) {
    const overridden = overriddenByHomework.get(a.id) ?? new Set<string>();
    const notified = notifiedByHomework.get(a.id) ?? new Set<string>();
    for (const studentId of studentsByClass.get(a.class_section_id) ?? []) {
      const isOverridden = overridden.has(studentId);
      const done = a.checked ? !isOverridden : isOverridden;
      if (!done && !notified.has(studentId)) {
        pending.push({ homeworkId: a.id, studentId });
      }
    }
  }
  if (pending.length === 0) return { notified: 0 };

  const titleByHomework = new Map(assignments.map((a) => [a.id, a.title]));
  const studentIds = [...new Set(pending.map((p) => p.studentId))];
  const { data: links } = await admin
    .from("guardian_student")
    .select("student_id, guardian_id")
    .in("student_id", studentIds);
  const guardianIdsByStudent = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = guardianIdsByStudent.get(l.student_id) ?? [];
    arr.push(l.guardian_id);
    guardianIdsByStudent.set(l.student_id, arr);
  }

  await Promise.all(
    pending.map((p) =>
      sendPush(
        (guardianIdsByStudent.get(p.studentId) ?? []).map((guardianId) => ({
          userId: guardianId,
          role: "guardian" as const,
        })),
        {
          title: "Homework not submitted",
          body: `${titleByHomework.get(p.homeworkId) ?? "Homework"} was due yesterday and hasn't been marked submitted.`,
          url: "/homework",
        },
        "defaulters"
      )
    )
  );

  const { error } = await admin.from("homework_notifications").upsert(
    pending.map((p) => ({ homework_id: p.homeworkId, student_id: p.studentId })),
    { onConflict: "homework_id,student_id" }
  );
  if (error) logError("[homework-notify] couldn't record notifications", error);

  return { notified: pending.length };
}
