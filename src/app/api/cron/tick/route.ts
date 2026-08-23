import { NextResponse } from "next/server";
import { syncFromSheet } from "@/lib/google-sheets";
import { notifyUnsubmittedHomework } from "@/lib/homework-notify";

/**
 * Vercel Cron hits this daily (see vercel.json). Runs the Sheets
 * roster/academic-config pull and the homework-not-submitted guardian
 * notification sweep. Idempotent and safe to call more often than the
 * schedule if triggered manually too.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([syncFromSheet(), notifyUnsubmittedHomework()]);
  const [sheetSync, homeworkNotify] = results;

  if (sheetSync.status === "rejected") {
    console.error("[cron] sheet sync failed:", sheetSync.reason);
  }
  if (homeworkNotify.status === "rejected") {
    console.error("[cron] homework notify failed:", homeworkNotify.reason);
  }

  return NextResponse.json({
    sheetSync: sheetSync.status,
    homeworkNotify: homeworkNotify.status,
  });
}
