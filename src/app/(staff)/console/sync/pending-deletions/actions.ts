"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

// Tables backing each subject_type. Deletion runs through the admin client
// rather than the RLS-scoped one: students/guardians/staff/guardian_student
// carry no staff write policy at all today (by design — the sheet is the
// single write path, see src/lib/google-sheets.ts), so no RLS-scoped role,
// including super_admin, could perform this delete. requireSuperAdmin() is
// the actual authorization gate here, stricter than any of the underlying
// tables' RLS.
const DELETABLE_TABLES = [
  "students",
  "guardians",
  "staff",
  "class_sections",
  "subjects",
  "timetable_entries",
] as const;
type DeletableTable = (typeof DELETABLE_TABLES)[number];

function assertDeletableTable(subjectType: string): DeletableTable {
  if ((DELETABLE_TABLES as readonly string[]).includes(subjectType)) {
    return subjectType as DeletableTable;
  }
  throw new Error(`Unknown subject_type "${subjectType}"`);
}

/** Confirms a queued deletion: removes the row from its source table, then marks the queue entry resolved. */
export async function confirmPendingDeletion(pendingId: string) {
  const viewer = await requireSuperAdmin();
  const supabase = createAdminClient();

  const { data: pending, error: fetchError } = await supabase
    .from("sheet_sync_pending_deletions")
    .select("*")
    .eq("id", pendingId)
    .single();
  if (fetchError || !pending) throw new Error(fetchError?.message ?? "Pending deletion not found");
  if (pending.resolved_at) return; // already resolved, nothing to do

  const table = assertDeletableTable(pending.subject_type);

  if (table === "guardians") {
    // No FK cascade is guaranteed here — drop the join rows explicitly first.
    await supabase.from("guardian_student").delete().eq("guardian_id", pending.subject_id);
  }

  const { error: deleteError } = await supabase.from(table).delete().eq("id", pending.subject_id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: resolveError } = await supabase
    .from("sheet_sync_pending_deletions")
    .update({ resolved_at: new Date().toISOString(), resolved_by: viewer.staff.id })
    .eq("id", pendingId);
  if (resolveError) throw new Error(resolveError.message);

  revalidatePath("/console/sync/pending-deletions");
  revalidatePath("/console/sync");
}
