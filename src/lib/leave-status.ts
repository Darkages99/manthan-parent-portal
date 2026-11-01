import type { Enums, Tables } from "@/lib/supabase/database.types";

/** Leave spanning more than this many days needs the principal's sign-off —
 * a class teacher can view it but not approve it. */
export const PRINCIPAL_APPROVAL_DAY_SPAN = 3;

/** Inclusive number of calendar days from `fromDate` to `toDate` (both `YYYY-MM-DD`). */
export function leaveDaySpan(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** True when this viewer may not approve the leave: a class teacher on a leave
 * longer than PRINCIPAL_APPROVAL_DAY_SPAN days. Shared by the approve action
 * (the enforcement) and the approval list (hides the button). */
export function leaveNeedsPrincipalApproval(
  viewerRole: Enums<"role">,
  fromDate: string,
  toDate: string
): boolean {
  return viewerRole === "class_teacher" && leaveDaySpan(fromDate, toDate) > PRINCIPAL_APPROVAL_DAY_SPAN;
}

export type LeaveDisplayStatus = "pending" | "approved" | "declined" | "expired";

/** A pending request whose leave window has already passed without a decision is expired — no longer actionable. */
export function leaveDisplayStatus(
  l: Pick<Tables<"leave_requests">, "status" | "to_date">,
  today: string
): LeaveDisplayStatus {
  if (l.status === "pending" && l.to_date < today) return "expired";
  return l.status;
}
