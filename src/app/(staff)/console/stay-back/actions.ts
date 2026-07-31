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
    .select("teacher_id")
    .eq("id", id)
    .single();
  if (!consent) throw new Error("Request not found");

  const isPrincipal = viewer.staff.role === "principal" || viewer.staff.role === "super_admin";
  const isNamedTeacher = consent.teacher_id === viewer.staff.id;

  const patch: TablesUpdate<"stay_back_consents"> = { status: decision };
  if (isNamedTeacher) {
    patch.teacher_decision = decision;
    patch.teacher_decided_at = new Date().toISOString();
  }
  if (isPrincipal) {
    patch.principal_decision = decision;
    patch.principal_decided_at = new Date().toISOString();
  }

  const { error } = await supabase.from("stay_back_consents").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/console/stay-back");
}
