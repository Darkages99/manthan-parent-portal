"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function resolveIssue(id: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("reported_issues")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: viewer.staff.id,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/console/issues");
}
