"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Self-serve account activation for a parent whose email staff already
 * approved (a `guardians` row with that email exists but has no
 * `auth_user_id` yet — see console/parents). The parent picks their own
 * password here; this is the only place a guardian's Supabase Auth user
 * gets created, mirroring createStaffAccount's admin-client pattern but
 * with no staff/principal gate since it's reached before sign-in.
 *
 * Deliberately returns the same error for "no matching guardian" and
 * "already activated" so this can't be used to probe which emails are on
 * file.
 */
export async function activateGuardianAccount(rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  const GENERIC_ERROR =
    "That email isn't ready to activate. If you already set a password, sign in instead — otherwise contact the front office.";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const admin = createAdminClient();

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, name, auth_user_id")
    .ilike("email", email)
    .maybeSingle();
  if (!guardian || guardian.auth_user_id) throw new Error(GENERIC_ERROR);

  // Phone is deliberately not attached here — the same mobile number is
  // often shared across two guardian rows (e.g. both parents), and phone
  // must be globally unique per Supabase Auth user, so attaching it could
  // fail activation for an unrelated reason. Sign-in stays email+password
  // only for self-activated accounts.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: guardian.name, kind: "guardian" },
  });
  if (authError) throw new Error(authError.message);

  const { error: linkError } = await admin
    .from("guardians")
    .update({ auth_user_id: authUser.user.id })
    .eq("id", guardian.id);
  if (linkError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(linkError.message);
  }
}
