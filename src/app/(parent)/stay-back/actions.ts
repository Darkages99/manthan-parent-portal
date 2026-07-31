"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

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

  // TODO: sendPush([named teacher, principal], {...}) once push subscriptions exist —
  // see src/lib/notifications/push.ts
  revalidatePath("/stay-back");
}
