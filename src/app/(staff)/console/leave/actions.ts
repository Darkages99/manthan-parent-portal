"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { leaveNeedsPrincipalApproval } from "@/lib/leave-status";
import { sendPush } from "@/lib/notifications/push";
import { sendMessage } from "@/app/(staff)/console/messages/compose/actions";

/** Approves a leave request. There's no decline anymore — a class teacher who
 * has a concern uses `sendLeaveMessage` instead of rejecting outright. Leaves
 * over 3 days need the principal (class_teacher is blocked at the DB-check
 * layer here, mirroring the app-layer gates used elsewhere like decidePtmBooking). */
export async function decideLeave(id: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("from_date, to_date, requested_by, reason")
    .eq("id", id)
    .single();
  if (!leave) throw new Error("Leave request not found");

  if (leaveNeedsPrincipalApproval(viewer.staff.role, leave.from_date, leave.to_date)) {
    throw new Error("Only the principal can approve a leave over 3 days");
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      decided_by: viewer.staff.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/console/leave");

  await sendPush(
    [{ userId: leave.requested_by, role: "guardian" as const }],
    { title: "Leave approved", body: `Your leave request (${leave.reason}) was approved.`, url: "/leave" },
    "leave"
  );
}

/** Sends a one-off message to the requesting guardian about their leave
 * request, reusing the general messaging pipeline (push + inbox + receipts)
 * instead of a bespoke delivery path. Available regardless of who decides —
 * this is the replacement for the removed "Decline" action. */
export async function sendLeaveMessage(leaveId: string, body: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!body.trim()) throw new Error("Message can't be empty");

  const supabase = await createClient();
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("student_id")
    .eq("id", leaveId)
    .single();
  if (!leave) throw new Error("Leave request not found");

  await sendMessage({
    subject: "About your child's leave request",
    body: body.trim(),
    urgent: false,
    scopeType: "student",
    classSectionIds: [],
    studentIds: [leave.student_id],
    groupIds: [],
  });
}
