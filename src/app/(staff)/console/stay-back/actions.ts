"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { decideApprovalStep, getApprovalChain } from "@/lib/approvals";
import { resolveApproverMatch } from "@/lib/approval-match";
import { sendPush } from "@/lib/notifications/push";

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

/**
 * Nudges every staff member who still owes a decision on this consent's
 * approval chain — the class teacher named on the step, or every active
 * staff member holding an unassigned step's role (front_office / coordinator
 * / principal, since more than one person can hold those roles).
 */
export async function remindStayBackApprovers(id: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: consent } = await supabase
    .from("stay_back_consents")
    .select("student_id, stay_date")
    .eq("id", id)
    .single();
  if (!consent) throw new Error("Request not found");

  const steps = await getApprovalChain(supabase, "stay_back_consent", id);
  const openSteps = steps.filter((s) => s.decision === null);
  if (openSteps.length === 0) return;

  const { data: student } = await supabase
    .from("students")
    .select("first_name, last_name")
    .eq("id", consent.student_id)
    .single();
  const studentName = student ? `${student.first_name} ${student.last_name}` : "a student";

  const assignedStaffIds = openSteps.map((s) => s.approver_staff_id).filter((v): v is string => !!v);
  const rolesNeedingLookup = [
    ...new Set(openSteps.filter((s) => !s.approver_staff_id).map((s) => s.approver_role)),
  ];

  let roleStaffIds: string[] = [];
  if (rolesNeedingLookup.length) {
    const { data: roleStaff } = await supabase
      .from("staff")
      .select("id, role")
      .in("role", rolesNeedingLookup)
      .eq("active", true);
    roleStaffIds = (roleStaff ?? []).map((s) => s.id);
  }

  const targetIds = [...new Set([...assignedStaffIds, ...roleStaffIds])];
  if (targetIds.length === 0) return;

  await sendPush(
    targetIds.map((userId) => ({ userId, role: "staff" as const })),
    {
      title: "Stay-back approval needed",
      body: `${studentName}'s stay-back request for ${consent.stay_date} is waiting on your approval.`,
      url: "/console/stay-back",
    },
    "reminders"
  );
}
