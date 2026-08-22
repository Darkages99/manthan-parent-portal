import { NextResponse } from "next/server";
import { syncFromSheet } from "@/lib/google-sheets";
import { dispatchDueReminders } from "@/lib/reminders";

/**
 * Vercel Cron hits this every 15 minutes (see vercel.json). Runs the Sheets
 * roster/academic-config pull and fires any due reminders. Both are idempotent
 * and safe to call more often than the schedule if triggered manually too.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([syncFromSheet(), dispatchDueReminders()]);
  const [sheetSync, reminders] = results;

  if (sheetSync.status === "rejected") {
    console.error("[cron] sheet sync failed:", sheetSync.reason);
  }
  if (reminders.status === "rejected") {
    console.error("[cron] reminder dispatch failed:", reminders.reason);
  }

  return NextResponse.json({
    sheetSync: sheetSync.status,
    reminders: reminders.status,
  });
}
