// Pure helpers shared by the guardian-facing and staff-facing PTM booking
// approval UI/actions. No "use server"/"use client" pragma — safe to import
// from either side.
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type ApprovalStep = Tables<"approval_steps">;
export type StaffRole = Enums<"role">;
export type ApprovalStepRole = Enums<"approval_step_role">;

/**
 * Maps a staff member's role onto the approval_step_role they act as when
 * deciding a PTM slot request. super_admin and coordinator both review as
 * principal — coordinator is treated as fully admin-equivalent throughout the
 * app (see src/lib/roles.ts PRINCIPAL_ROLES). The per-meeting `admin` role
 * also maps here so its step shows as "theirs to decide" — decidePtmBooking
 * then further restricts the actual decision to that meeting's
 * assigned_admin_id (or a super_admin). Returns null for roles that never
 * approve PTM booking requests (e.g. accounts, parent).
 */
export function resolveApproverRole(staffRole: StaffRole): ApprovalStepRole | null {
  if (
    staffRole === "principal" ||
    staffRole === "super_admin" ||
    staffRole === "coordinator" ||
    staffRole === "admin"
  ) {
    return "principal";
  }
  if (staffRole === "class_teacher" || staffRole === "front_office") {
    return staffRole;
  }
  return null;
}

/** Finds the viewer's own open (undecided) step in a PTM slot's approval chain, if any. */
export function findMyOpenStep(
  steps: ApprovalStep[],
  staffRole: StaffRole,
  staffId: string
): ApprovalStep | null {
  const approverRole = resolveApproverRole(staffRole);
  if (!approverRole) return null;
  const matchByStaffId = approverRole === "class_teacher";
  return (
    steps.find((s) => {
      if (s.decision !== null) return false;
      if (s.approver_role !== approverRole) return false;
      if (matchByStaffId) return s.approver_staff_id === staffId;
      return true;
    }) ?? null
  );
}
