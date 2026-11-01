import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import type { Enums } from "@/lib/supabase/database.types";

export type NotificationCategory = Enums<"notification_category">;

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

/** Recipients per lookup. Every id travels in the query string (`.or("guardian_id.in.(…)")`),
 * and ~1,600 uuids (a school-wide broadcast) is ~60 KB of URL — far past what gateways
 * accept, so the lookup fails outright. 100 ids keeps each URL around 4 KB. */
const RECIPIENT_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** PostgREST `or(...)` expression matching any of these targets, or null for none. */
function recipientFilter(targets: PushTarget[]): string | null {
  const guardianIds = targets.filter((t) => t.role === "guardian").map((t) => t.userId);
  const staffIds = targets.filter((t) => t.role === "staff").map((t) => t.userId);
  const clauses: string[] = [];
  if (guardianIds.length) clauses.push(`guardian_id.in.(${guardianIds.join(",")})`);
  if (staffIds.length) clauses.push(`staff_id.in.(${staffIds.join(",")})`);
  return clauses.length ? clauses.join(",") : null;
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

/**
 * Drops targets that have explicitly disabled push for this category via
 * notification_preferences. Absence of a row means enabled (default on).
 */
async function filterByPreference(
  supabase: ReturnType<typeof createAdminClient>,
  targets: PushTarget[],
  category: NotificationCategory
): Promise<PushTarget[]> {
  const disabledGuardianIds = new Set<string>();
  const disabledStaffIds = new Set<string>();

  await Promise.all(
    chunk(targets, RECIPIENT_CHUNK).map(async (group) => {
      const filter = recipientFilter(group);
      if (!filter) return;
      const { data: disabled, error } = await supabase
        .from("notification_preferences")
        .select("guardian_id, staff_id")
        .eq("category", category)
        .eq("enabled", false)
        .or(filter);
      if (error) {
        // Fail open: an unreadable preference must not silence a notification.
        logError("[push] could not read notification preferences", error);
        return;
      }
      for (const d of disabled ?? []) {
        if (d.guardian_id) disabledGuardianIds.add(d.guardian_id);
        if (d.staff_id) disabledStaffIds.add(d.staff_id);
      }
    })
  );

  return targets.filter((t) =>
    t.role === "guardian" ? !disabledGuardianIds.has(t.userId) : !disabledStaffIds.has(t.userId)
  );
}

export async function sendPush(
  targetsIn: PushTarget[],
  payload: PushPayload,
  category: NotificationCategory
): Promise<void> {
  if (targetsIn.length === 0) return;
  if (!ensureVapid()) {
    console.warn(
      "[push] skipped — set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (see `npm run vapid:keys`)."
    );
    return;
  }

  const supabase = createAdminClient();
  const targets = await filterByPreference(supabase, targetsIn, category);
  if (targets.length === 0) return;

  type Sub = {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    guardian_id: string | null;
    staff_id: string | null;
  };
  const subs: Sub[] = [];
  await Promise.all(
    chunk(targets, RECIPIENT_CHUNK).map(async (group) => {
      const filter = recipientFilter(group);
      if (!filter) return;
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth, guardian_id, staff_id")
        .or(filter);
      if (error) {
        // A failed chunk only loses that chunk's devices; the audit log below
        // still records those recipients as not delivered.
        logError("[push] could not read subscriptions", error);
        return;
      }
      subs.push(...(data ?? []));
    })
  );

  const notification = JSON.stringify(payload);

  // Tracks which targets (by "role:id" key) got at least one successful send —
  // a target can own several devices/subscriptions, so success is per-target,
  // not per-subscription.
  const deliveredKeys = new Set<string>();

  if (subs.length > 0) {
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            notification
          );
          deliveredKeys.add(s.guardian_id ? `guardian:${s.guardian_id}` : `staff:${s.staff_id}`);
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404/410 = the browser has dropped this subscription; prune it so we
          // don't keep trying. Anything else is logged and left in place.
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            logError("[push] send failed", err);
          }
        }
      })
    );
  }

  // Durable log so the school can prove a parent/staff member was notified of
  // something on a given date/time — one row per attempted target, regardless
  // of whether a device was actually reachable.
  await supabase.from("notification_log").insert(
    targets.map((t) => ({
      recipient_type: t.role,
      recipient_id: t.userId,
      category,
      title: payload.title,
      body: payload.body,
      delivered: deliveredKeys.has(`${t.role}:${t.userId}`),
    }))
  );
}
