"use client";

import { useState } from "react";
import { DownloadIcon } from "./icons";

/** Top-right "Export to CSV" button — the date-range filter stays hidden
 * until clicked, so it never clutters the main screen. Downloading doesn't
 * touch the page's own (unfiltered) list. */
export function ExportCsvButton({ href, label = "Export to CSV" }: { href: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const downloadHref = `${href}${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist"
      >
        <DownloadIcon className="h-4 w-4" />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate">
            Filter (optional)
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-maroon">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-sm border border-hairline bg-mist px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span className="font-medium text-maroon">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-sm border border-hairline bg-mist px-2.5 py-1.5 text-sm"
            />
          </label>
          <a
            href={downloadHref}
            className="mt-3 block rounded-sm bg-maroon px-3 py-2 text-center text-sm font-semibold text-cream hover:bg-maroon-strong"
          >
            Download CSV
          </a>
        </div>
      )}
    </div>
  );
}
