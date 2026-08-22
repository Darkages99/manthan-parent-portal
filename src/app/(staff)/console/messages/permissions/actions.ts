"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";
import type { Enums } from "@/lib/supabase/database.types";

export async function updateSendPermission(
  role: Enums<"role">,
  scopeType: Enums<"message_scope_type">,
  allowed: boolean
) {
  await requirePrincipal();

  const supabase = await createClient();
  const { error } = await supabase
    .from("message_send_permissions")
    .update({ allowed })
    .eq("role", role)
    .eq("scope_type", scopeType);
  if (error) throw new Error(error.message);

  revalidatePath("/console/messages/permissions");
}
