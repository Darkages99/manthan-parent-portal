"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importTimetableCsv } from "@/app/(staff)/console/timetable/actions";
import { DownloadIcon } from "./icons";

/**
 * Lets a principal bulk-import timetable cells from a CSV file. Columns:
 * class_section, day_of_week, period, subject, teacher.
 */
export function TimetableCsvImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const text = await file.text();
        const res = await importTimetableCsv(text);
        setResult(res);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-heading text-base text-maroon">Import from CSV</p>
          <p className="text-sm text-slate">
            Columns: class_section, day_of_week (1–6), period, subject, teacher.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist">
          <DownloadIcon className="h-4 w-4 rotate-180" />
          {isPending ? "Importing…" : "Choose CSV file"}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={isPending}
            onChange={onFileChange}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 text-sm">
          <p className="font-semibold text-slate-strong">
            Imported {result.imported} row{result.imported === 1 ? "" : "s"}
            {result.errors.length > 0 ? `, ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}` : ""}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-rose-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
