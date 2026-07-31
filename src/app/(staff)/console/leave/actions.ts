"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function decideLeave(id: string, decision: "approved" | "declined") {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      decided_by: viewer.staff.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/console/leave");
}
