"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePrincipal, requireSuperAdmin } from "@/lib/roles";
import { deleteFileAdmin, storagePathFromDownloadUrl } from "@/lib/firebase/admin-storage";
import { logError } from "@/lib/log";

type StudentInput = {
  firstName: string;
  lastName: string;
  rollNo: string;
  classSectionId: string;
  photoUrl: string;
};

/** Creates a student directly (outside the Sheets sync path) — used by the
 * staff-facing Students section. Class is always required, and a student must
 * have at least one parent (enforced in the DB too). The student and its
 * guardian links are inserted atomically via an RPC so the deferred integrity
 * triggers see the final state. */
export async function createStudent(input: StudentInput, guardianIds: string[]) {
  await requirePrincipal();
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("First and last name are required");
  if (!input.rollNo.trim()) throw new Error("Roll number is required");
  if (!input.classSectionId) throw new Error("Class is required");
  const parentIds = [...new Set(guardianIds ?? [])].filter(Boolean);
  if (parentIds.length === 0) throw new Error("A student must have at least one parent");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_student_with_guardians", {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_roll_no: input.rollNo.trim(),
    p_class_section_id: input.classSectionId,
    p_guardian_ids: parentIds,
    p_photo_url: input.photoUrl.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/console/students");
}

/** Edits an existing student's name, roll number, class or photo. */
export async function updateStudent(id: string, input: StudentInput) {
  await requirePrincipal();
  if (!id) throw new Error("Student is required");
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("First and last name are required");
  if (!input.rollNo.trim()) throw new Error("Roll number is required");
  if (!input.classSectionId) throw new Error("Class is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      roll_no: input.rollNo.trim(),
      class_section_id: input.classSectionId,
      photo_url: input.photoUrl.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/students");
}

/** Deletes a student. Fails with a readable message if other records
 * (attendance, results, ...) still reference them with a restrictive FK. */
export async function deleteStudent(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Student is required");

  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "Can't delete — this student still has linked records (attendance, results, etc.)."
        : error.message
    );
  }
  revalidatePath("/console/students");
}

/**
 * Right-to-erasure (DG-1 / DPDP). Permanently removes a student and every
 * dependent record across all tables, plus any guardian left with no remaining
 * children, then deletes their files from Firebase Storage and their Supabase
 * Auth users. Super-admin only. The DB side runs in one transaction via the
 * `erase_student` RPC (which re-checks super_admin and logs an 'ERASE' audit
 * row); this action performs the external cleanup the database can't reach.
 */
export async function eraseStudent(id: string) {
  await requireSuperAdmin();
  if (!id) throw new Error("Student is required");

  // Called through the user's session client so the RPC's current_staff_role()
  // super_admin check resolves against the caller.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("erase_student", { p_student: id });
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as {
    report_card_urls?: string[];
    receipt_urls?: string[];
    orphaned_guardian_auth_ids?: string[];
  };

  const admin = createAdminClient();

  // Best-effort external cleanup — a failure here must not leave the DB erasure
  // half-done (that already committed), so we log a safe code and continue.
  for (const url of [...(result.report_card_urls ?? []), ...(result.receipt_urls ?? [])]) {
    const path = storagePathFromDownloadUrl(url);
    if (!path) continue;
    try {
      await deleteFileAdmin(path);
    } catch (e) {
      logError("[erase] storage delete failed", e);
    }
  }

  for (const authId of result.orphaned_guardian_auth_ids ?? []) {
    try {
      await admin.auth.admin.deleteUser(authId);
    } catch (e) {
      logError("[erase] auth user delete failed", e);
    }
  }

  revalidatePath("/console/students");
  revalidatePath("/console/parents");
}
