"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";
import { createApprovalChain } from "@/lib/approvals";
import type { Enums } from "@/lib/supabase/database.types";

export async function raiseStayBack(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const studentId = String(formData.get("studentId"));
  const teacherId = String(formData.get("teacherId"));
  const reason = String(formData.get("reason"));
  const date = String(formData.get("date"));
  const fromTime = String(formData.get("fromTime"));
  const toTime = String(formData.get("toTime"));
  const purpose = String(formData.get("purpose") || "others") as Enums<"stay_back_purpose">;
  const purposeDetailRaw = formData.get("purposeDetail");
  const purposeDetail =
    purpose === "others" && purposeDetailRaw ? String(purposeDetailRaw).trim() || null : null;
  const modeOfTransportRaw = formData.get("modeOfTransport");
  const modeOfTransport = modeOfTransportRaw ? String(modeOfTransportRaw).trim() || null : null;

  if (!studentId || !teacherId || !reason || !date || !fromTime || !toTime) {
    throw new Error("All fields are required");
  }

  const supabase = await createClient();
  const { data: consent, error } = await supabase
    .from("stay_back_consents")
    .insert({
      student_id: studentId,
      raised_by_guardian_id: viewer.guardian.id,
      teacher_id: teacherId,
      reason,
      stay_date: date,
      from_time: fromTime,
      to_time: toTime,
      purpose,
      purpose_detail: purposeDetail,
      mode_of_transport: modeOfTransport,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // 4-step approval chain: the named teacher specifically, then front office,
  // coordinator, and finally principal (or super_admin, handled at decision time).
  await createApprovalChain(supabase, "stay_back_consent", consent.id, [
    { approverRole: "class_teacher", approverStaffId: teacherId },
    { approverRole: "front_office" },
    { approverRole: "coordinator" },
    { approverRole: "principal" },
  ]);

  // Best-effort: notify the named teacher (first approval step) plus every
  // principal/super_admin (last step) so the two named/most-senior parties
  // get an immediate heads-up. Front office and coordinator pick requests up
  // from their console queue.
  try {
    const admin = createAdminClient();
    const { data: principals } = await admin
      .from("staff")
      .select("id")
      .in("role", ["principal", "super_admin"]);

    const targetIds = new Set([teacherId, ...(principals ?? []).map((p) => p.id)]);
    const studentName = viewer.students.find((s) => s.id === studentId)?.first_name ?? "your child";

    await sendPush(
      [...targetIds].map((userId) => ({ userId, role: "staff" as const })),
      {
        title: "Stay-back consent request",
        body: `${studentName} — ${reason} on ${date}`,
        url: "/console/stay-back",
      },
      "stay_back"
    );
  } catch (err) {
    console.error("[stay-back] notification failed:", (err as Error).message);
  }

  revalidatePath("/stay-back");
}
