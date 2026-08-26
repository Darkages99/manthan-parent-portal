import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { RecalculateStorageButton } from "@/components/recalculate-storage-button";
import { formatDateTime } from "@/lib/format";

const GB = 1024 * 1024 * 1024;

export default async function StorageUsagePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff" || !isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const { data: snapshot } = await supabase
    .from("storage_usage_snapshots")
    .select("*")
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dbGb = snapshot ? snapshot.db_bytes / GB : 0;
  const fileGb = snapshot ? snapshot.file_bytes / GB : 0;
  const totalGb = dbGb + fileGb;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Housekeeping</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Storage usage</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          A rough figure for how much data the app is holding on its servers, so you know when it&apos;s
          worth backing up and starting fresh.
        </p>
      </div>

      {snapshot ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="text-sm uppercase tracking-wide text-slate">Database</p>
              <p className="mt-1 font-heading text-3xl text-maroon">{dbGb.toFixed(2)} GB</p>
            </div>
            <div className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="text-sm uppercase tracking-wide text-slate">Files (report cards, attachments…)</p>
              <p className="mt-1 font-heading text-3xl text-maroon">{fileGb.toFixed(2)} GB</p>
            </div>
            <div className="rounded-sm border border-rust/40 bg-rust-tint/30 p-5 shadow-[var(--shadow-card)]">
              <p className="text-sm uppercase tracking-wide text-slate">Total</p>
              <p className="mt-1 font-heading text-3xl text-maroon">{totalGb.toFixed(2)} GB</p>
            </div>
          </div>
          <p className="text-sm text-slate">As of {formatDateTime(snapshot.computed_at)}.</p>
        </div>
      ) : (
        <p className="text-base text-slate">Not calculated yet — click below to get a first reading.</p>
      )}

      <RecalculateStorageButton />
    </div>
  );
}
