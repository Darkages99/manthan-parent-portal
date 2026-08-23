"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePrincipal } from "@/lib/roles";
import { alertsForDeactivatedStaff, insertStaffAlerts } from "@/lib/staff-alerts";
import type { Enums } from "@/lib/supabase/database.types";

const INTERNAL_EMAIL_DOMAIN = "staff.manthan.internal";

/** Creates a staff account: an auth user (via the service-role admin client,
 * since `auth.admin.createUser` isn't available on the RLS-scoped client)
 * plus its linked `staff` row.
 *
 * `username` + `password` are always required and are the account's baseline
 * sign-in credentials. `phone`/`email` are optional extras: if given, they're
 * attached to the same auth user so OTP (phone) or Google sign-in (email,
 * subject to Supabase's provider email matching) also work — without them,
 * the account is password-only via `<username>@staff.manthan.internal`. */
export async function createStaffAccount(input: {
  name: string;
  username: string;
  password: string;
  phone: string;
  email: string;
  role: Enums<"role">;
}) {
  await requirePrincipal();
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  const password = input.password;
  const phone = input.phone.trim();
  const email = input.email.trim();
  if (!name || !username || !password) throw new Error("Name, username and password are all required");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error("Username must be 3-32 characters: letters, numbers, dots, dashes or underscores");
  }
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const admin = createAdminClient();

  const { data: existingUsername } = await admin
    .from("staff")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existingUsername) throw new Error("That username is already taken");

  const authEmail = email || `${username}@${INTERNAL_EMAIL_DOMAIN}`;
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    phone: phone || undefined,
    email_confirm: true,
    phone_confirm: phone ? true : undefined,
    user_metadata: { name, kind: "staff" },
  });
  if (authError) throw new Error(authError.message);

  const { error: staffError } = await admin.from("staff").insert({
    auth_user_id: authUser.user.id,
    name,
    username,
    phone: phone || null,
    email: email || null,
    role: input.role,
    active: true,
  });
  if (staffError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(staffError.message);
  }

  revalidatePath("/console/staff");
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
 * sign in — see getViewer()'s `active = true` filter in src/lib/session.ts.
 * Deactivating raises an alert for every class/subject assignment they held,
 * so the principal knows what needs reassigning. */
export async function setStaffActive(staffId: string, active: boolean) {
  await requirePrincipal();
  if (!staffId) throw new Error("Staff member is required");

  const supabase = await createClient();

  if (!active) {
    const alerts = await alertsForDeactivatedStaff(supabase, staffId);
    if (alerts.length > 0) await insertStaffAlerts(supabase, staffId, alerts);
  }

  const { error } = await supabase.from("staff").update({ active }).eq("id", staffId);
  if (error) throw new Error(error.message);
  revalidatePath("/console/staff");
  revalidatePath("/console");
}

/** Dismisses a staff-reassignment alert once it's been handled. */
export async function resolveStaffAlert(alertId: string) {
  await requirePrincipal();
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_reassignment_alerts")
    .update({ resolved: true })
    .eq("id", alertId);
  if (error) throw new Error(error.message);
  revalidatePath("/console");
}
