import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { SheetSyncControls } from "@/components/sheet-sync-controls";
import { formatSlotTime } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  running: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default async function ConsoleSync() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const [{ data: runs }, { count: pendingCount }] = await Promise.all([
    supabase.from("sheet_sync_runs").select("*").order("started_at", { ascending: false }).limit(20),
    supabase
      .from("sheet_sync_pending_deletions")
      .select("*", { count: "exact", head: true })
      .is("resolved_at", null),
  ]);

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const hasSpreadsheet = Boolean(spreadsheetId);
  const sheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
          <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Sheet sync</h1>
          <p className="mt-2 max-w-prose text-lg text-slate-strong">
            Students, guardians, teachers, class sections, subjects and the timetable are managed in a
            Google Sheet — additions and edits there apply here automatically. Rows removed from the
            sheet are never auto-deleted; they wait for a super admin to confirm, and are mirrored,
            highlighted in red, in the sheet&apos;s own &quot;Pending Deletions&quot; tab.
          </p>
        </div>
        {sheetUrl && (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-sm bg-maroon px-4 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong"
          >
            Open Google Sheet →
          </a>
        )}
      </div>

      <section className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
        <SheetSyncControls hasSpreadsheet={hasSpreadsheet} />
      </section>

      <Link
        href="/console/sync/pending-deletions"
        className={`flex items-center justify-between gap-4 rounded-sm border p-5 shadow-[var(--shadow-card)] transition hover:border-rust/60 ${
          (pendingCount ?? 0) > 0 ? "border-rust/40 bg-rust-tint/30" : "border-hairline bg-surface"
        }`}
      >
        <div>
          <p className="font-heading text-2xl text-maroon">Pending deletions</p>
          <p className="mt-1 text-base text-slate-strong">
            Rows that disappeared from the sheet, awaiting a super admin&apos;s confirmation.
          </p>
        </div>
        <p className="font-heading text-4xl text-maroon">{pendingCount ?? 0}</p>
      </Link>

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Recent runs</h2>
        {!runs || runs.length === 0 ? (
          <p className="text-base text-slate">No sync runs yet.</p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
            {runs.map((run) => (
              <li key={run.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-maroon">
                    {formatSlotTime(run.started_at)}
                    {run.finished_at && <span className="text-slate-strong"> → {formatSlotTime(run.finished_at)}</span>}
                  </p>
                  {run.error_summary && (
                    <p className="mt-1 max-w-prose truncate text-sm text-rose-600" title={run.error_summary}>
                      {run.error_summary}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${
                    STATUS_STYLE[run.status] ?? STATUS_STYLE.running
                  }`}
                >
                  {run.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
