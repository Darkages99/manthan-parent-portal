import { NextResponse } from "next/server";
import { syncFromSheet } from "@/lib/google-sheets";

/**
 * Vercel Cron hits this daily (see vercel.json). Runs the Sheets
 * roster/academic-config pull. Idempotent and safe to call more often than
 * the schedule if triggered manually too.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([syncFromSheet()]);
  const [sheetSync] = results;

  if (sheetSync.status === "rejected") {
    console.error("[cron] sheet sync failed:", sheetSync.reason);
  }

  return NextResponse.json({
    sheetSync: sheetSync.status,
  });
}
