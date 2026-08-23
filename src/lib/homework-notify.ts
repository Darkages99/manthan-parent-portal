import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";

/** Yesterday's date in IST as YYYY-MM-DD — homework whose due date just passed. */
function yesterdayIst(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Notifies guardians of every student still marked "not submitted" on
 * homework whose due date passed yesterday, then stamps notified_at so the
 * next cron run doesn't repeat it. Run daily from /api/cron/tick. */
export async function notifyUnsubmittedHomework(): Promise<{ notified: number }> {
  const admin = createAdminClient();
  const dueDate = yesterdayIst();

  const { data: assignments } = await admin
    .from("homework_assignments")
    .select("id, title")
    .eq("due_date", dueDate);
  if (!assignments || assignments.length === 0) return { notified: 0 };

  const homeworkIds = assignments.map((a) => a.id);
  const { data: pending } = await admin
    .from("homework_submissions")
    .select("id, homework_id, student_id")
    .in("homework_id", homeworkIds)
    .is("notified_at", null);
  if (!pending || pending.length === 0) return { notified: 0 };

  const titleByHomework = new Map(assignments.map((a) => [a.id, a.title]));
  const studentIds = [...new Set(pending.map((p) => p.student_id))];
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
        (guardianIdsByStudent.get(p.student_id) ?? []).map((guardianId) => ({
          userId: guardianId,
          role: "guardian" as const,
        })),
        {
          title: "Homework not submitted",
          body: `${titleByHomework.get(p.homework_id) ?? "Homework"} was due yesterday and hasn't been marked submitted.`,
          url: "/homework",
        },
        "defaulters"
      )
    )
  );

  const { error } = await admin
    .from("homework_submissions")
    .update({ notified_at: new Date().toISOString() })
    .in(
      "id",
      pending.map((p) => p.id)
    );
  if (error) console.error("[homework-notify] couldn't stamp notified_at:", error.message);

  return { notified: pending.length };
}
