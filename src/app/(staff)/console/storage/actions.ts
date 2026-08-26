"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";
import { getBucketUsageBytes } from "@/lib/firebase/admin-storage";

/** Recomputes the storage-usage snapshot (Postgres DB size + Firebase Storage
 * bucket size) and records it. Deliberately on-demand, not automatic — both
 * measurements involve real work (a full Storage listing), so this only runs
 * when a principal explicitly asks for a fresh number. */
export async function recalculateStorageUsage() {
  const viewer = await requirePrincipal();
  const supabase = await createClient();

  const [{ data: dbBytes, error: dbError }, fileBytes] = await Promise.all([
    supabase.rpc("database_size_bytes"),
    getBucketUsageBytes(),
  ]);
  if (dbError) throw new Error(dbError.message);

  const { error } = await supabase.from("storage_usage_snapshots").insert({
    db_bytes: dbBytes ?? 0,
    file_bytes: fileBytes,
    computed_by: viewer.staff.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/console/storage");
  revalidatePath("/console");
}
