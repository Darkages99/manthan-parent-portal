"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

/** Marks all of this guardian's delivered-but-unread message receipts as read.
 * Called when the guardian opens the inbox, so the nav badge count clears. */
export async function markMessagesRead() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") return;

  const supabase = await createClient();
  await supabase
    .from("message_receipts")
    .update({ read_at: new Date().toISOString() })
    .eq("guardian_id", viewer.guardian.id)
    .is("read_at", null);
}
