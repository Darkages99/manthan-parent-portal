"use client";

import { useState, useTransition } from "react";
import { upsertResult, deleteResult } from "@/app/(staff)/console/results/actions";
import { GRADE_OPTIONS, TERM_OPTIONS, withCurrentValue } from "@/lib/grades";
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
    </div>
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
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-sm bg-rust px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            Delete
          </button>
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
        <button
          type="button"
          onClick={add}
          disabled={pending || !term || !subject || !marks}
          className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          Add
        </button>
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
