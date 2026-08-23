import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { createApprovalChain, getApprovalChain, type ApprovalStepInput } from "@/lib/approvals";

/**
 * The stay-back approval chain: the named class teacher, then front office,
 * then coordinator (skipped for grade 8+, where the principal acts as
 * coordinator — see src/lib/roles.ts), then principal. Shared by request
 * creation and the console's self-heal so both always build the same chain.
 */
export function buildStayBackChainSteps(
  teacherId: string,
  grade: string | number | null | undefined,
): ApprovalStepInput[] {
  const numericGrade =
    typeof grade === "number"
      ? grade
      : grade != null && /^\d+$/.test(String(grade))
        ? Number(grade)
        : null;
  const skipCoordinator = numericGrade !== null && numericGrade >= 8;

  return [
    { approverRole: "class_teacher", approverStaffId: teacherId },
    { approverRole: "front_office" },
    ...(skipCoordinator ? [] : [{ approverRole: "coordinator" as const }]),
    { approverRole: "principal" },
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
  const pendingWithoutSteps: typeof consents = [];
  for (const c of consents) {
    if (c.status !== "pending") continue;
    const existing = await getApprovalChain(supabase, "stay_back_consent", c.id);
    if (existing.length === 0) pendingWithoutSteps.push(c);
  }
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
