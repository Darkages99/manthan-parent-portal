"use client";

import { useState, useTransition } from "react";
import { saveGradeConfig } from "@/app/(staff)/console/results/subject/actions";
import { Button } from "./button";
import { useToast } from "./toast-provider";

type BandInput = { key: number; grade: string; minPct: string; maxPct: string };

let nextKey = 0;

/**
 * Configures, once per subject+term, the max marks for that exam and the
 * percentage bands that map to each letter grade (e.g. 80–90 → A). Saved
 * here, then reused everywhere marks are entered for this subject+term —
 * SubjectMarksTable, the CSV importer, and the main results editor all
 * auto-fill grade from these bands instead of the teacher picking one.
 */
export function GradeBoundariesEditor({
  subject,
  term,
  initialMaxMarks,
  initialBands,
}: {
  subject: string;
  term: string;
  initialMaxMarks: number;
  initialBands: { grade: string; minPct: number; maxPct: number }[];
}) {
  const [maxMarks, setMaxMarks] = useState(String(initialMaxMarks));
  const [bands, setBands] = useState<BandInput[]>(
    initialBands.map((b) => ({ key: nextKey++, grade: b.grade, minPct: String(b.minPct), maxPct: String(b.maxPct) }))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function addBand() {
    setBands((prev) => [...prev, { key: nextKey++, grade: "", minPct: "", maxPct: "" }]);
  }

  function removeBand(key: number) {
    setBands((prev) => prev.filter((b) => b.key !== key));
  }

  function updateBand(key: number, field: "grade" | "minPct" | "maxPct", value: string) {
    setBands((prev) => prev.map((b) => (b.key === key ? { ...b, [field]: value } : b)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveGradeConfig({
          subject,
          term,
          maxMarks: Number(maxMarks),
          bands: bands.map((b) => ({ grade: b.grade.trim(), minPct: Number(b.minPct), maxPct: Number(b.maxPct) })),
        });
        toast.success("Grading scale saved");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't save";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="font-heading text-base text-maroon">
        Grading scale — {subject} · {term}
      </p>
      <p className="mt-1 text-sm text-slate">
        Set the max marks once and define percentage bands (e.g. 80–90 = A). Marks entered below will get their
        grade automatically.
      </p>

      <label className="mt-4 flex w-40 flex-col gap-1 text-sm font-medium text-slate-strong">
        Max marks
        <input
          type="number"
          value={maxMarks}
          onChange={(e) => setMaxMarks(e.target.value)}
          className="rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        />
      </label>

      <div className="mt-4 flex flex-col gap-2">
        {bands.map((b) => (
          <div key={b.key} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={b.grade}
              onChange={(e) => updateBand(b.key, "grade", e.target.value)}
              placeholder="Grade (e.g. A)"
              className="w-32 rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
            />
            <input
              type="number"
              value={b.minPct}
              onChange={(e) => updateBand(b.key, "minPct", e.target.value)}
              placeholder="Min %"
              className="w-24 rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
            />
            <span className="text-sm text-slate">to</span>
            <input
              type="number"
              value={b.maxPct}
              onChange={(e) => updateBand(b.key, "maxPct", e.target.value)}
              placeholder="Max %"
              className="w-24 rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
            />
            <Button type="button" size="sm" variant="danger" onClick={() => removeBand(b.key)}>
              Remove
            </Button>
          </div>
        ))}
        {bands.length === 0 && <p className="text-sm text-slate">No bands yet — add one below.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addBand}>
          + Add band
        </Button>
        <Button type="button" size="sm" onClick={save} loading={pending}>
          Save configuration
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
