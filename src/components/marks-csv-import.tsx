"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importMarksCsv } from "@/app/(staff)/console/results/actions";
import { TERM_OPTIONS, withCurrentValue } from "@/lib/grades";
import { DownloadIcon } from "./icons";

/**
 * Bulk-enters marks for the currently selected class from a CSV. Columns:
 * roll_no, subject, marks, max_marks (optional, default 100), grade
 * (optional). Term is picked once for the whole file rather than being a
 * column, since it's the same for every row in a normal upload.
 */
export function MarksCsvImport({
  classId,
  editableSubjects,
}: {
  classId: string;
  editableSubjects: "all" | string[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const termOptions = withCurrentValue(TERM_OPTIONS, term);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    if (!term.trim()) {
      setError("Pick a term first");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    startTransition(async () => {
      try {
        const text = await file.text();
        const res = await importMarksCsv(classId, term, text);
        setResult(res);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  const subjectHint = editableSubjects === "all" ? "any subject" : editableSubjects.join(", ");

  return (
    <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-heading text-base text-maroon">Bulk import marks</p>
          <p className="text-sm text-slate">
            Columns: roll_no, subject, marks, max_marks (optional, default 100), grade (optional). You can enter{" "}
            {subjectHint} for this class.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-maroon">Term</span>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
            >
              <option value="">— Term —</option>
              {termOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 text-sm">
          <p className="font-semibold text-slate-strong">
            Imported {result.imported} mark{result.imported === 1 ? "" : "s"}
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
