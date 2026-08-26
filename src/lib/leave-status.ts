import type { Tables } from "@/lib/supabase/database.types";

export type LeaveDisplayStatus = "pending" | "approved" | "declined" | "expired";

/** A pending request whose leave window has already passed without a decision is expired — no longer actionable. */
export function leaveDisplayStatus(
  l: Pick<Tables<"leave_requests">, "status" | "to_date">,
  today: string
): LeaveDisplayStatus {
  if (l.status === "pending" && l.to_date < today) return "expired";
  return l.status;
}
