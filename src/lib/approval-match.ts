import type { Enums } from "@/lib/supabase/database.types";

export type ApproverMatch = {
  approverRole: Enums<"approval_step_role">;
  /** Also require approver_staff_id === viewer id (used for the class_teacher step). */
  matchByStaffId: boolean;
};

/**
 * Maps a staff viewer to the approval_steps row they're allowed to decide for
 * a stay-back consent, given the teacher named on that consent.
 *
 * - class_teacher can only decide if they are the specifically named teacher.
 * - front_office / coordinator decide their own step directly.
 * - principal and super_admin both satisfy the 'principal' step, since
 *   super_admin has always been treated as principal-equivalent elsewhere in
 *   this codebase.
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
  if (viewerRole === "front_office" || viewerRole === "coordinator") {
    return { approverRole: viewerRole, matchByStaffId: false };
  }
  if (viewerRole === "principal" || viewerRole === "super_admin") {
    return { approverRole: "principal", matchByStaffId: false };
  }
  return null;
}
