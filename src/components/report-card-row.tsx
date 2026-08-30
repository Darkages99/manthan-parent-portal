"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeReportCard } from "@/app/(staff)/console/results/actions";
import { Button } from "./button";
import { DownloadIcon } from "./icons";
import { useToast } from "./toast-provider";

/** Single-student, single-term report-card upload/replace/remove — shared by
 * the Results editor (in-context, per student) and the Report Cards page
 * (roster view, single or alongside mass upload). */
export function ReportCardRow({
  studentId,
  term,
  url,
  studentName,
  rollNo,
}: {
  studentId: string;
  term: string;
  url: string | null;
  studentName?: string;
  rollNo?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startUpload(async () => {
      try {
        const form = new FormData();
        form.set("studentId", studentId);
        form.set("term", term);
        form.set("file", file);
        const res = await fetch("/api/report-card/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        toast.success("Report card published");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        toast.error(message);
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function remove() {
    if (!confirm(`Remove the published report card for ${term}?`)) return;
    setError(null);
    startRemove(async () => {
      try {
        await removeReportCard(studentId, term);
        toast.success("Report card removed");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't remove";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-hairline bg-mist/40 px-4 py-2.5 text-sm">
      <div>
        {studentName && (
          <span className="mr-2 text-slate-strong">
            {rollNo && <span className="text-slate">#{rollNo}</span>} {studentName}
          </span>
        )}
        <span className="font-semibold text-maroon">{term}</span>
        <span className={`ml-2 ${url ? "text-emerald-700 dark:text-emerald-300" : "text-slate"}`}>
          {url ? "Published" : "Not published"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-hairline bg-surface px-3 py-1.5 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist">
          <DownloadIcon className="h-4 w-4 rotate-180" />
          {isUploading ? "Uploading…" : url ? "Replace" : "Upload PDF"}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={isUploading}
            onChange={onFileChange}
          />
        </label>
        {url && (
          <Button type="button" size="sm" variant="danger" onClick={remove} disabled={isRemoving}>
            Remove
          </Button>
        )}
      </div>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </li>
  );
}
