"use server";

import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Shape produced by PushSubscription.toJSON() on the client.
export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Stores (or refreshes) the signed-in user's push subscription. Runs under the
 * user's session so RLS ties the row to their guardian/staff id. */
export async function savePushSubscription(sub: PushSubscriptionInput): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Not signed in");
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Malformed push subscription");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      guardian_id: viewer.type === "guardian" ? viewer.guardian.id : null,
      staff_id: viewer.type === "staff" ? viewer.staff.id : null,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

/** Removes a subscription when the user turns notifications off or the browser
 * revokes it. RLS scopes the delete to rows the user owns. */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
