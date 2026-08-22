"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";

export async function reportIssue(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const confidential = formData.get("confidential") === "on";

  if (!subject || !body) throw new Error("Subject and details are required");

  const supabase = await createClient();
  const { error } = await supabase.from("reported_issues").insert({
    reported_by_guardian_id: viewer.guardian.id,
    subject,
    body,
    confidential,
  });

  if (error) throw new Error(error.message);

  if (confidential) {
    // Best-effort: let the principal/super_admin know a confidential report has
    // come in. A failure here shouldn't fail the report submission itself.
    try {
      const admin = createAdminClient();
      const { data: principals } = await admin
        .from("staff")
        .select("id")
        .in("role", ["principal", "super_admin"]);

      await sendPush(
        (principals ?? []).map((p) => ({ userId: p.id, role: "staff" as const })),
        {
          title: "Confidential issue reported",
          body: subject,
          url: "/console/issues",
        },
        "messages"
      );
    } catch (err) {
      console.error("[report-issue] notification failed:", (err as Error).message);
    }
  }

  revalidatePath("/report-issue");
}
