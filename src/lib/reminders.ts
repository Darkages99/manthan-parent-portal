import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";

/**
 * Fires push notifications for every reminder whose remind_at has passed and
 * that hasn't been sent yet, then stamps sent_at so it isn't picked up again.
 * Called from the cron tick route (src/app/api/cron/tick/route.ts) every 15
 * minutes. Each row is handled independently so one bad send (e.g. a stale
 * push subscription or a missing owner) doesn't block the rest of the batch.
 */
export async function dispatchDueReminders(): Promise<void> {
  const admin = createAdminClient();

  const { data: due, error } = await admin
    .from("reminders")
    .select("*")
    .lte("remind_at", new Date().toISOString())
    .is("sent_at", null);

  if (error) {
    console.error("[reminders] could not load due reminders:", error.message);
    return;
  }
  if (!due || due.length === 0) return;

  for (const reminder of due) {
    try {
      const userId = reminder.guardian_id ?? reminder.staff_id;
      if (!userId) throw new Error(`reminder ${reminder.id} has neither guardian_id nor staff_id`);
      const role = reminder.guardian_id ? "guardian" : "staff";

      await sendPush([{ userId, role }], { title: "Reminder", body: reminder.message }, "reminders");

      const { error: updateError } = await admin
        .from("reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);
      if (updateError) throw new Error(updateError.message);
    } catch (err) {
      console.error(`[reminders] dispatch failed for reminder ${reminder.id}:`, (err as Error).message);
    }
  }
}
