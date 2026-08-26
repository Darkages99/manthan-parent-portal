"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertResult, deleteResult, removeReportCard } from "@/app/(staff)/console/results/actions";
import { GRADE_OPTIONS, TERM_OPTIONS, withCurrentValue } from "@/lib/grades";
import { Button } from "./button";
import { DownloadIcon } from "./icons";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Result = Tables<"exam_results">;

const inputCls =
  "rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong";

export function ResultsEditor({
  studentId,
  results,
  subjects,
}: {
  studentId: string;
  results: Result[];
  subjects: string[];
}) {
  const terms = [...new Set(results.map((r) => r.term))].sort().reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-maroon text-cream">
            <tr>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Term</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Subject</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Marks</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Max</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Grade</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {results.map((r) => (
              <ResultRow key={r.id} studentId={studentId} result={r} subjects={subjects} />
            ))}
            <AddResultRow studentId={studentId} subjects={subjects} />
          </tbody>
        </table>
      </div>
      {results.length === 0 && (
        <p className="text-sm text-slate">No marks entered yet — add the first row above.</p>
      )}

      {terms.length > 0 && (
        <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
          <p className="font-heading text-base text-maroon">Report card PDFs</p>
          <ul className="mt-3 flex flex-col gap-2">
            {terms.map((term) => {
              const url = results.find((r) => r.term === term)?.report_card_pdf_url ?? null;
              return <ReportCardRow key={term} studentId={studentId} term={term} url={url} />;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportCardRow({ studentId, term, url }: { studentId: string; term: string; url: string | null }) {
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

function ResultRow({
  studentId,
  result,
  subjects,
}: {
  studentId: string;
  result: Result;
  subjects: string[];
}) {
  const [term, setTerm] = useState(result.term);
  const [subject, setSubject] = useState(result.subject);
  const [marks, setMarks] = useState(String(result.marks));
  const [max, setMax] = useState(String(result.max_marks));
  const [grade, setGrade] = useState(result.grade ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const dirty =
    term !== result.term ||
    subject !== result.subject ||
    marks !== String(result.marks) ||
    max !== String(result.max_marks) ||
    grade !== (result.grade ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertResult({
          id: result.id,
          studentId,
          term,
          subject,
          marks: Number(marks),
          maxMarks: Number(max),
          grade: grade || null,
        });
        toast.success("Mark saved");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't save";
        setError(message);
        toast.error(message);
      }
    });
  }

  function remove() {
    if (!confirm("Delete this mark?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteResult(result.id);
        toast.success("Mark deleted");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't delete";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <tr>
      <td className="px-3 py-2">
        <TermSelect value={term} onChange={setTerm} className="w-28" />
      </td>
      <td className="px-3 py-2">
        <SubjectSelect value={subject} onChange={setSubject} subjects={subjects} />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          className={`w-20 ${inputCls}`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className={`w-20 ${inputCls}`}
        />
      </td>
      <td className="px-3 py-2">
        <GradeSelect value={grade} onChange={setGrade} className="w-20" />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {dirty && (
            <Button type="button" size="sm" onClick={save} loading={pending}>
              Save
            </Button>
          )}
          <Button type="button" size="sm" variant="danger" onClick={remove} disabled={pending}>
            Delete
          </Button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}

function AddResultRow({ studentId, subjects }: { studentId: string; subjects: string[] }) {
  const [term, setTerm] = useState("");
  const [subject, setSubject] = useState("");
  const [marks, setMarks] = useState("");
  const [max, setMax] = useState("100");
  const [grade, setGrade] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertResult({
          studentId,
          term,
          subject,
          marks: Number(marks),
          maxMarks: Number(max),
          grade: grade || null,
        });
        setTerm("");
        setSubject("");
        setMarks("");
        setMax("100");
        setGrade("");
        toast.success("Mark added");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't add";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <tr className="bg-mist/40">
      <td className="px-3 py-2">
        <TermSelect value={term} onChange={setTerm} className="w-28" />
      </td>
      <td className="px-3 py-2">
        <SubjectSelect value={subject} onChange={setSubject} subjects={subjects} />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          placeholder="0"
          className={`w-20 ${inputCls}`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className={`w-20 ${inputCls}`}
        />
      </td>
      <td className="px-3 py-2">
        <GradeSelect value={grade} onChange={setGrade} className="w-20" />
      </td>
      <td className="px-3 py-2">
        <Button
          type="button"
          size="sm"
          onClick={add}
          loading={pending}
          disabled={!term || !subject || !marks}
        >
          Add
        </Button>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}

function SubjectSelect({
  value,
  onChange,
  subjects,
}: {
  value: string;
  onChange: (v: string) => void;
  subjects: string[];
}) {
  const options = withCurrentValue(subjects, value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-40 ${inputCls}`}
      aria-label="Subject"
    >
      <option value="">— Subject —</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function TermSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const options = withCurrentValue(TERM_OPTIONS, value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} ${inputCls}`}
      aria-label="Term"
    >
      <option value="">— Term —</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function GradeSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const options = withCurrentValue(GRADE_OPTIONS, value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} ${inputCls}`}
      aria-label="Grade"
    >
      <option value="">— Grade —</option>
      {options.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}
