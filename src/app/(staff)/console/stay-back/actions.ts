"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import type { TablesUpdate } from "@/lib/supabase/database.types";

export async function decideStayBack(id: string, decision: "approved" | "declined") {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");

  const supabase = await createClient();
  const { data: consent } = await supabase
    .from("stay_back_consents")
    .select("teacher_id, teacher_decision, principal_decision")
    .eq("id", id)
    .single();
  if (!consent) throw new Error("Request not found");

  const isPrincipal = viewer.staff.role === "principal" || viewer.staff.role === "super_admin";
  const isNamedTeacher = consent.teacher_id === viewer.staff.id;
  if (!isPrincipal && !isNamedTeacher) throw new Error("You aren't a party to this request");

  if (isNamedTeacher && consent.teacher_decision) throw new Error("You've already decided this request");
  if (isPrincipal && consent.principal_decision) throw new Error("You've already decided this request");

  const patch: TablesUpdate<"stay_back_consents"> = {};
  const teacherDecision = isNamedTeacher ? decision : consent.teacher_decision;
  const principalDecision = isPrincipal ? decision : consent.principal_decision;
  if (isNamedTeacher) {
    patch.teacher_decision = decision;
    patch.teacher_decided_at = new Date().toISOString();
  }
  if (isPrincipal) {
    patch.principal_decision = decision;
    patch.principal_decided_at = new Date().toISOString();
  }

  // Both must approve for the request to succeed; either side declining
  // closes it immediately without waiting on the other party.
  if (teacherDecision === "declined" || principalDecision === "declined") {
    patch.status = "declined";
  } else if (teacherDecision === "approved" && principalDecision === "approved") {
    patch.status = "approved";
  }

  const { error } = await supabase.from("stay_back_consents").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/console/stay-back");
}
