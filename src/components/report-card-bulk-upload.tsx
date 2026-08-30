"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon } from "./icons";

/**
 * Mass-publishes report card PDFs for a whole class + term. Each file is
 * matched to a student by filename (roll number first, then full name) on
 * the server — see /api/report-card/bulk-upload/route.ts.
 */
export function ReportCardBulkUpload({ classId, term }: { classId: string; term: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; errors: { file: string; message: string }[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("classId", classId);
        form.set("term", term);
        for (const file of files) form.append("files", file);
        const res = await fetch("/api/report-card/bulk-upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        setResult(data);
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
          <p className="font-heading text-base text-maroon">Mass upload report cards</p>
          <p className="text-sm text-slate">
            Select every PDF at once. Each filename (minus the extension) is matched to a student in
            this class by roll number, then by name — e.g. &quot;101.pdf&quot; or &quot;John_Doe.pdf&quot;.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist">
          <DownloadIcon className="h-4 w-4 rotate-180" />
          {isPending ? "Uploading…" : "Choose PDF files"}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            disabled={isPending}
            onChange={onFilesChange}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 text-sm">
          <p className="font-semibold text-slate-strong">
            Published {result.imported} report card{result.imported === 1 ? "" : "s"}
            {result.errors.length > 0 ? `, ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}` : ""}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-rose-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.file}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
