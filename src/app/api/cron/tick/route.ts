import { NextResponse } from "next/server";
import { syncFromSheet } from "@/lib/google-sheets";
import { notifyUnsubmittedHomework } from "@/lib/homework-notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/** DG-1 retention: prune the append-only logs past their retention window.
 * Runs under the service-role client (the RPC is granted to service_role). */
async function pruneOldRecords(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("prune_old_records");
  if (error) throw new Error(error.message);
}

/**
 * Vercel Cron hits this daily (see vercel.json). Runs the Sheets
 * roster/academic-config pull and the homework-not-submitted guardian
 * notification sweep. Idempotent and safe to call more often than the
 * schedule if triggered manually too.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset/empty secret must never authenticate (otherwise a
  // bare `Bearer ` / `Bearer undefined` would pass).
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured — refusing to run.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([
    syncFromSheet(),
    notifyUnsubmittedHomework(),
    pruneOldRecords(),
  ]);
  const [sheetSync, homeworkNotify, retention] = results;

  if (sheetSync.status === "rejected") {
    logError("[cron] sheet sync failed", sheetSync.reason);
  }
  if (homeworkNotify.status === "rejected") {
    logError("[cron] homework notify failed", homeworkNotify.reason);
  }
  if (retention.status === "rejected") {
    logError("[cron] retention prune failed", retention.reason);
  }

  return NextResponse.json({
    sheetSync: sheetSync.status,
    homeworkNotify: homeworkNotify.status,
    retention: retention.status,
  });
}
