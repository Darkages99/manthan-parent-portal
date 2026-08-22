import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "@/lib/supabase/database.types";

export type ApprovalStep = Tables<"approval_steps">;
export type ApprovalSubjectType = Enums<"approval_subject_type">;
export type ApprovalStepRole = Enums<"approval_step_role">;
export type ApprovalDecision = Enums<"approval_decision">;

export type SubjectStatus = "pending" | "approved" | "declined";

/** Any decline closes the subject; it's only approved once every step is. */
export function computeSubjectStatus(steps: Pick<ApprovalStep, "decision">[]): SubjectStatus {
  if (steps.length === 0) return "pending";
  if (steps.some((s) => s.decision === "declined")) return "declined";
  if (steps.every((s) => s.decision === "approved")) return "approved";
  return "pending";
}

export interface ApprovalStepInput {
  approverRole: ApprovalStepRole;
  /** Pre-assign the deciding staff member (e.g. the named class teacher); left null otherwise. */
  approverStaffId?: string | null;
}

export async function createApprovalChain(
  supabase: SupabaseClient<Database>,
  subjectType: ApprovalSubjectType,
  subjectId: string,
  steps: ApprovalStepInput[],
) {
  const rows = steps.map((step, index) => ({
    subject_type: subjectType,
    subject_id: subjectId,
    step_order: index + 1,
    approver_role: step.approverRole,
    approver_staff_id: step.approverStaffId ?? null,
  }));
  const { error } = await supabase.from("approval_steps").insert(rows);
  if (error) throw error;
}

export async function getApprovalChain(
  supabase: SupabaseClient<Database>,
  subjectType: ApprovalSubjectType,
  subjectId: string,
): Promise<ApprovalStep[]> {
  const { data, error } = await supabase
    .from("approval_steps")
    .select("*")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("step_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Records a decision for whichever open step matches the caller, identified
 * either by role (front_office/coordinator/principal) or by a pre-assigned
 * approver_staff_id (the named class teacher). Throws if no open step matches
 * or the caller's step was already decided.
 */
export async function decideApprovalStep(
  supabase: SupabaseClient<Database>,
  params: {
    subjectType: ApprovalSubjectType;
    subjectId: string;
    approverRole: ApprovalStepRole;
    staffId: string;
    decision: ApprovalDecision;
    /** Only match a step pre-assigned to this staff id (used for class_teacher steps). */
    matchByStaffId?: boolean;
  },
): Promise<SubjectStatus> {
  const steps = await getApprovalChain(supabase, params.subjectType, params.subjectId);

  const step = steps.find((s) => {
    if (s.decision !== null) return false;
    if (params.matchByStaffId) {
      return s.approver_role === params.approverRole && s.approver_staff_id === params.staffId;
    }
    return s.approver_role === params.approverRole;
  });

  if (!step) {
    throw new Error("No open approval step for this role, or it was already decided.");
  }

  const { error } = await supabase
    .from("approval_steps")
    .update({
      decision: params.decision,
      approver_staff_id: step.approver_staff_id ?? params.staffId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", step.id);
  if (error) throw error;

  const updated = steps.map((s) => (s.id === step.id ? { ...s, decision: params.decision } : s));
  return computeSubjectStatus(updated);
}
