import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Web Push, wired to the `push_subscriptions` table. Each guardian/staff device
 * that opts in stores one subscription row (see savePushSubscription in
 * src/app/actions/push.ts); sendPush fans a payload out to every device of the
 * given targets and prunes any subscription the browser has since dropped.
 *
 * iOS Safari only supports this from 16.4+, and only once the parent has added
 * the app to their home screen — so urgent sends should also fall back to SMS
 * rather than relying on push alone.
 */

export interface PushTarget {
  userId: string; // guardians.id or staff.id
  role: "guardian" | "staff";
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // deep link opened on tap, e.g. /stay-back/sb-1
}

let vapidConfigured = false;

/** Configures web-push from env the first time it's needed. Returns false when
 * VAPID keys aren't set, so callers can no-op instead of throwing in dev. */
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  const subject = process.env.VAPID_SUBJECT || "mailto:office@manthanvidyashram.in";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<void> {
  if (targets.length === 0) return;
  if (!ensureVapid()) {
    console.warn(
      "[push] skipped — set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (see `npm run vapid:keys`)."
    );
    return;
  }

  const guardianIds = targets.filter((t) => t.role === "guardian").map((t) => t.userId);
  const staffIds = targets.filter((t) => t.role === "staff").map((t) => t.userId);

  const orClauses: string[] = [];
  if (guardianIds.length) orClauses.push(`guardian_id.in.(${guardianIds.join(",")})`);
  if (staffIds.length) orClauses.push(`staff_id.in.(${staffIds.join(",")})`);
  if (orClauses.length === 0) return;

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .or(orClauses.join(","));
  if (error) {
    console.error("[push] could not read subscriptions:", error.message);
    return;
  }
  if (!subs || subs.length === 0) return;

  const notification = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notification
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 = the browser has dropped this subscription; prune it so we
        // don't keep trying. Anything else is logged and left in place.
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push] send failed", statusCode ?? "", (err as Error).message);
        }
      }
    })
  );
}
