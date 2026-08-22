"use server";

import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/lib/roles";
import { syncFromSheet, provisionSheet } from "@/lib/google-sheets";

/** Runs the Sheets → Postgres sync job on demand (the same job the cron hits every 15 min). */
export async function runSyncNow() {
  await requirePrincipal();
  await syncFromSheet();
  revalidatePath("/console/sync");
}

/** One-time setup: creates (or reuses) the spreadsheet, writes headers, and shares it with principal/super_admin staff. */
export async function runProvisionSheet() {
  await requirePrincipal();
  const result = await provisionSheet();
  revalidatePath("/console/sync");
  return result;
}
