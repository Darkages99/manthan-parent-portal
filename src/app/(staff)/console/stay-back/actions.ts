"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { decideApprovalStep } from "@/lib/approvals";
import { resolveApproverMatch } from "@/lib/approval-match";

export async function decideStayBack(id: string, decision: "approved" | "declined") {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: consent } = await supabase
    .from("stay_back_consents")
    .select("teacher_id")
    .eq("id", id)
    .single();
  if (!consent) throw new Error("Request not found");

  const match = resolveApproverMatch(viewer.staff.role, viewer.staff.id, consent.teacher_id);
  if (!match) throw new Error("You aren't a party to this request");

  // Finds the caller's open step in the class_teacher -> front_office ->
  // [coordinator ->] principal chain and records the decision; any decline
  // closes the whole request, approval only completes once every step has.
  // Coordinator is admin-equivalent (see src/lib/roles.ts): grade 8+ chains
  // skip the dedicated coordinator step, so a coordinator falls back to
  // deciding the principal step directly on those requests.
  let status;
  try {
    status = await decideApprovalStep(supabase, {
      subjectType: "stay_back_consent",
      subjectId: id,
      approverRole: match.approverRole,
      staffId: viewer.staff.id,
      decision,
      matchByStaffId: match.matchByStaffId,
    });
  } catch (err) {
    if (viewer.staff.role !== "coordinator" || match.approverRole !== "coordinator") throw err;
    status = await decideApprovalStep(supabase, {
      subjectType: "stay_back_consent",
      subjectId: id,
      approverRole: "principal",
      staffId: viewer.staff.id,
      decision,
      matchByStaffId: false,
    });
  }

  const { error } = await supabase.from("stay_back_consents").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/console/stay-back");
}
