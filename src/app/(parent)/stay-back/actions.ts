"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";

export async function raiseStayBack(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const studentId = String(formData.get("studentId"));
  const teacherId = String(formData.get("teacherId"));
  const reason = String(formData.get("reason"));
  const date = String(formData.get("date"));
  const fromTime = String(formData.get("fromTime"));
  const toTime = String(formData.get("toTime"));

  if (!studentId || !teacherId || !reason || !date || !fromTime || !toTime) {
    throw new Error("All fields are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stay_back_consents").insert({
    student_id: studentId,
    raised_by_guardian_id: viewer.guardian.id,
    teacher_id: teacherId,
    reason,
    stay_date: date,
    from_time: fromTime,
    to_time: toTime,
  });

  if (error) throw new Error(error.message);

  // Best-effort: notify the named teacher plus every principal/super_admin.
  // Both parties must approve, so both need the heads-up.
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
      }
    );
  } catch (err) {
    console.error("[stay-back] notification failed:", (err as Error).message);
  }

  revalidatePath("/stay-back");
}
