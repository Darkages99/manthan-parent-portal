"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function requestLeave(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const studentId = String(formData.get("studentId"));
  const fromDate = String(formData.get("fromDate"));
  const toDate = String(formData.get("toDate"));
  const reason = String(formData.get("reason"));

  if (!studentId || !fromDate || !toDate || !reason) throw new Error("All fields are required");
  if (toDate < fromDate) throw new Error("The end date can't be before the start date");

  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    student_id: studentId,
    requested_by: viewer.guardian.id,
    from_date: fromDate,
    to_date: toDate,
    reason,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/leave");
}
