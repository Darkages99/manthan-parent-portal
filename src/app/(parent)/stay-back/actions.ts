"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";
import { createApprovalChain } from "@/lib/approvals";
import { buildStayBackChainSteps } from "@/lib/stay-back-chain";

export async function raiseStayBack(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const studentId = String(formData.get("studentId"));
  const teacherId = String(formData.get("teacherId"));
  const reason = String(formData.get("reason"));
  const date = String(formData.get("date"));
  const fromTime = String(formData.get("fromTime"));
  const toTime = String(formData.get("toTime"));
  const foodTransportAgreed = formData.get("foodTransportAgreed") === "on";

  if (!studentId || !teacherId || !reason || !date || !fromTime || !toTime) {
    throw new Error("All fields are required");
  }
  if (!foodTransportAgreed) {
    throw new Error("Please confirm you'll arrange food and transportation for your child");
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("class_section_id, class_sections(grade)")
    .eq("id", studentId)
    .single();
  const grade = (student?.class_sections as { grade: string } | null)?.grade;

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
      mode_of_transport: "Parent-arranged",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[stay-back] insert failed:", error.message);
    throw new Error(error.message);
  }

  // Named teacher, then front office, [coordinator for grades below 8,] then principal.
  // RLS only lets staff write approval_steps, so use the admin client here
  // (mirrors src/app/(parent)/ptm/actions.ts bookSlot).
  const admin = createAdminClient();
  await createApprovalChain(
    admin,
    "stay_back_consent",
    consent.id,
    buildStayBackChainSteps(teacherId, grade),
  );

  // Best-effort: notify the named teacher (first approval step) plus every
  // principal/super_admin (last step) so the two named/most-senior parties
  // get an immediate heads-up. Front office and coordinator pick requests up
  // from their console queue.
  try {
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
