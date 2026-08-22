"use client";

import { useState, useTransition } from "react";
import { runSyncNow, runProvisionSheet } from "@/app/(staff)/console/sync/actions";

export function SheetSyncControls({ hasSpreadsheet }: { hasSpreadsheet: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<{ url: string } | null>(null);

  function onSyncNow() {
    setError(null);
    startTransition(async () => {
      try {
        await runSyncNow();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed");
      }
    });
  }

  function onProvision() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await runProvisionSheet();
        setProvisioned(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't provision the sheet");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={isPending}
          onClick={onSyncNow}
          className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          {isPending ? "Working…" : "Sync now"}
        </button>
        {!hasSpreadsheet && (
          <button
            disabled={isPending}
            onClick={onProvision}
            className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
          >
            Provision sheet
          </button>
        )}
      </div>
      {provisioned && (
        <p className="text-base text-slate-strong">
          Sheet created:{" "}
          <a href={provisioned.url} target="_blank" rel="noreferrer" className="font-semibold text-rust underline">
            open in Google Sheets
          </a>
          . Add <code>GOOGLE_SHEETS_SPREADSHEET_ID</code> to your environment so future syncs reuse it.
        </p>
      )}
      {error && <p className="text-base text-rose-600">{error}</p>}
    </div>
  );
}
