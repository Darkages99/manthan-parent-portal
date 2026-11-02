import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { createApprovalChain, type ApprovalStepInput } from "@/lib/approvals";

/**
 * The final approver of a stay-back: the coordinator for grades 1–7, the
 * principal for grade 8 and up (or when the grade isn't a plain number).
 */
export function stayBackFinalApprover(
  grade: string | number | null | undefined,
): "coordinator" | "principal" {
  const numericGrade =
    typeof grade === "number"
      ? grade
      : grade != null && /^\d+$/.test(String(grade))
        ? Number(grade)
        : null;
  return numericGrade !== null && numericGrade < 8 ? "coordinator" : "principal";
}

/**
 * The stay-back approval chain: the named class teacher, then front office,
 * then the coordinator (grades 1–7) or the principal (grade 8+). Shared by
 * request creation and the console's self-heal so both always build the same
 * chain. RLS (approval_steps) lets each approver decide only their own step.
 */
export function buildStayBackChainSteps(
  teacherId: string,
  grade: string | number | null | undefined,
): ApprovalStepInput[] {
  return [
    { approverRole: "class_teacher", approverStaffId: teacherId },
    { approverRole: "front_office" },
    { approverRole: stayBackFinalApprover(grade) },
  ];
}

/**
 * Backfills approval chains for any pending consents that have none — e.g.
 * requests created before the chain existed, or where chain creation failed
 * after the consent row was already inserted. Without steps the console shows
 * a bare "pending" with no per-approver breakdown and no way to decide, so we
 * heal lazily whenever the console loads. Idempotent: the (subject, step_order)
 * unique constraint makes a double-run a no-op, and only pending consents that
 * currently have zero steps are touched. Must be called with a staff-context
 * client (RLS lets staff write approval_steps).
 */
export async function ensureStayBackChains(
  supabase: SupabaseClient<Database>,
  consents: Pick<Tables<"stay_back_consents">, "id" | "teacher_id" | "student_id" | "status">[],
  gradeByStudentId: Record<string, string | null | undefined>,
): Promise<boolean> {
  const pending = consents.filter((c) => c.status === "pending");
  if (pending.length === 0) return false;

  // Single query for all existing steps (was an N+1 getApprovalChain per consent).
  const { data: existingSteps } = await supabase
    .from("approval_steps")
    .select("subject_id")
    .eq("subject_type", "stay_back_consent")
    .in(
      "subject_id",
      pending.map((c) => c.id),
    );
  const withSteps = new Set((existingSteps ?? []).map((s) => s.subject_id));
  const pendingWithoutSteps = pending.filter((c) => !withSteps.has(c.id));
  if (pendingWithoutSteps.length === 0) return false;

  for (const c of pendingWithoutSteps) {
    await createApprovalChain(
      supabase,
      "stay_back_consent",
      c.id,
      buildStayBackChainSteps(c.teacher_id, gradeByStudentId[c.student_id]),
    );
  }
  return true;
}
