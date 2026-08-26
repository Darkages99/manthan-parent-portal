"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { sendPush } from "@/lib/notifications/push";
import type { Enums } from "@/lib/supabase/database.types";

/** Only front office or principal-tier staff may schedule/decline a
 * consultation request — a class teacher has no role here. */
function requireConsultationDecider(role: Enums<"role">) {
  if (role !== "front_office" && !isPrincipalRole(role)) {
    throw new Error("Only front office or the principal can decide consultation requests");
  }
}

export async function decideConsultation(
  id: string,
  decision: "scheduled" | "declined",
  scheduledTime?: string,
  note?: string
) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  requireConsultationDecider(viewer.staff.role);
  if (decision === "scheduled" && !scheduledTime) throw new Error("Pick a time to schedule");

  const supabase = await createClient();
  const { data: consultation } = await supabase
    .from("parent_consultations")
    .select("requested_by, preferred_date, student_id")
    .eq("id", id)
    .single();
  if (!consultation) throw new Error("Request not found");

  const { error } = await supabase
    .from("parent_consultations")
    .update({
      status: decision,
      scheduled_time: decision === "scheduled" ? scheduledTime : null,
      decision_note: note?.trim() || null,
      decided_by: viewer.staff.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/consultations");

  await sendPush(
    [{ userId: consultation.requested_by, role: "guardian" as const }],
    {
      title: decision === "scheduled" ? "Consultation scheduled" : "Consultation declined",
      body:
        decision === "scheduled"
          ? `Your consultation on ${consultation.preferred_date} is set for ${scheduledTime}.`
          : `Your consultation request for ${consultation.preferred_date} was declined.${note ? ` ${note}` : ""}`,
      url: "/consultations",
    },
    "consultations"
  );
}
