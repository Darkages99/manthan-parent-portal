"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePrincipal } from "@/lib/roles";
import type { Enums } from "@/lib/supabase/database.types";

function randomPassword(): string {
  return `Mp${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}!`;
}

/** Creates a staff account: an auth user (via the service-role admin client,
 * since `auth.admin.createUser` isn't available on the RLS-scoped client)
 * plus its linked `staff` row. Returns the one-time temp password to relay to
 * the new staff member. */
export async function createStaffAccount(input: {
  name: string;
  phone: string;
  email: string;
  role: Enums<"role">;
}): Promise<{ tempPassword: string }> {
  await requirePrincipal();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  if (!name || !phone || !email) throw new Error("Name, phone and email are all required");

  const tempPassword = randomPassword();
  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, kind: "staff" },
  });
  if (authError) throw new Error(authError.message);

  const { error: staffError } = await admin.from("staff").insert({
    auth_user_id: authUser.user.id,
    name,
    phone,
    email,
    role: input.role,
    active: true,
  });
  if (staffError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(staffError.message);
  }

  revalidatePath("/console/staff");
  return { tempPassword };
}

/** Changes a staff member's role. */
export async function updateStaffRole(staffId: string, role: Enums<"role">) {
  await requirePrincipal();
  if (!staffId) throw new Error("Staff member is required");

  const supabase = await createClient();
  const { error } = await supabase.from("staff").update({ role }).eq("id", staffId);
  if (error) throw new Error(error.message);
  revalidatePath("/console/staff");
}

/** Activates or deactivates a staff account. Deactivated staff can no longer
 * sign in — see getViewer()'s `active = true` filter in src/lib/session.ts. */
export async function setStaffActive(staffId: string, active: boolean) {
  await requirePrincipal();
  if (!staffId) throw new Error("Staff member is required");

  const supabase = await createClient();
  const { error } = await supabase.from("staff").update({ active }).eq("id", staffId);
  if (error) throw new Error(error.message);
  revalidatePath("/console/staff");
}
