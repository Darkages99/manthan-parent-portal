"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";
import { logError } from "@/lib/log";
import type { Enums } from "@/lib/supabase/database.types";

export type ReportIssueInput = {
  subject: string;
  body: string;
  audience: Enums<"issue_audience">;
  recipientStaffIds: string[];
};

export async function reportIssue(input: ReportIssueInput) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) throw new Error("Subject and details are required");

  const recipientStaffIds = [...new Set(input.recipientStaffIds ?? [])].filter(Boolean);
  // Directing a report to teacher(s) means those teachers + front office +
  // principal, so we always widen the audience to include front office.
  const audience: Enums<"issue_audience"> =
    recipientStaffIds.length > 0 ? "front_office_and_principal" : input.audience;

  const supabase = await createClient();
  const { data: issue, error } = await supabase
    .from("reported_issues")
    .insert({ reported_by_guardian_id: viewer.guardian.id, subject, body, audience })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (recipientStaffIds.length > 0) {
    const { error: recErr } = await supabase
      .from("reported_issue_recipients")
      .insert(recipientStaffIds.map((staff_id) => ({ issue_id: issue.id, staff_id })));
    if (recErr) throw new Error(recErr.message);
  }

  // Best-effort: notify everyone who can see the report. A failure here must not
  // fail the submission itself.
  try {
    const admin = createAdminClient();
    const targetIds = new Set<string>();

    const { data: principals } = await admin
      .from("staff")
      .select("id")
      .in("role", ["principal", "super_admin", "coordinator"]);
    for (const p of principals ?? []) targetIds.add(p.id);

    if (audience === "front_office_and_principal") {
      const { data: frontOffice } = await admin
        .from("staff")
        .select("id")
        .in("role", ["front_office", "admin"]);
      for (const f of frontOffice ?? []) targetIds.add(f.id);
    }

    for (const staffId of recipientStaffIds) targetIds.add(staffId);

    await sendPush(
      [...targetIds].map((id) => ({ userId: id, role: "staff" as const })),
      {
        title: recipientStaffIds.length > 0 ? "An issue was directed to you" : "New issue reported",
        body: subject,
        url: "/console/issues",
      },
      "messages"
    );
  } catch (err) {
    logError("[report-issue] notification failed", err);
  }

  revalidatePath("/report-issue");
}
