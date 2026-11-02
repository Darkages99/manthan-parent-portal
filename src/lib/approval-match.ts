import type { Enums } from "@/lib/supabase/database.types";

export type ApproverMatch = {
  approverRole: Enums<"approval_step_role">;
  /** Also require approver_staff_id === viewer id (used for the class_teacher step). */
  matchByStaffId: boolean;
  /** Decide whichever step is open next, whatever its role (super_admin only). */
  anyOpenStep?: boolean;
};

/**
 * Maps a staff viewer to the approval_steps row they're allowed to decide for
 * a stay-back consent, given the teacher named on that consent.
 *
 * - class_teacher can only decide if they are the specifically named teacher.
 * - front_office / coordinator / principal decide their own step directly.
 *   The coordinator's step exists only for grades 1–7 and the principal's only
 *   for grade 8+ (see stay-back-chain.ts), so neither stands in for the other.
 * - super_admin can decide any open step.
 *
 * Returns null if the viewer's role isn't a party to the approval chain at all.
 * Pure and framework-free so it can be shared between the server action and
 * the client-side approval list (no "server-only" import).
 */
export function resolveApproverMatch(
  viewerRole: Enums<"role">,
  viewerStaffId: string,
  namedTeacherId: string,
): ApproverMatch | null {
  if (viewerRole === "class_teacher") {
    if (viewerStaffId !== namedTeacherId) return null;
    return { approverRole: "class_teacher", matchByStaffId: true };
  }
  if (viewerRole === "front_office" || viewerRole === "coordinator" || viewerRole === "principal") {
    return { approverRole: viewerRole, matchByStaffId: false };
  }
  if (viewerRole === "super_admin") {
    return { approverRole: "principal", matchByStaffId: false, anyOpenStep: true };
  }
  return null;
}
