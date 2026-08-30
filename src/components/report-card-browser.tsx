"use client";

import { useRouter } from "next/navigation";
import { ComboBox } from "./combobox";
import { TERM_OPTIONS } from "@/lib/grades";

type ClassLite = { id: string; grade: string; section: string };

/** Class + term pickers that drive the Report Cards page via the URL query. */
export function ReportCardBrowser({
  classes,
  selectedClassId,
  selectedTerm,
}: {
  classes: ClassLite[];
  selectedClassId: string;
  selectedTerm: string;
}) {
  const router = useRouter();

  function navigate(classId: string, term: string) {
    const params = new URLSearchParams();
    if (classId) params.set("class", classId);
    if (term) params.set("term", term);
    const qs = params.toString();
    router.push(qs ? `/console/report-cards?${qs}` : "/console/report-cards");
  }

  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex w-56 flex-col gap-1 text-sm font-medium text-slate-strong">
        Class
        <ComboBox
          options={classes.map((c) => ({
            value: c.id,
            label: `Grade ${c.grade}-${c.section}`,
          }))}
          value={selectedClassId}
          onChange={(classId) => navigate(classId, selectedTerm)}
          placeholder="Select a class…"
          ariaLabel="Class"
          recallKey="report-cards-class"
        />
      </label>

      <label className="flex w-56 flex-col gap-1 text-sm font-medium text-slate-strong">
        Term
        <ComboBox
          options={TERM_OPTIONS.map((t) => ({ value: t, label: t }))}
          value={selectedTerm}
          onChange={(term) => navigate(selectedClassId, term)}
          disabled={!selectedClassId}
          placeholder="Select a term…"
          ariaLabel="Term"
        />
      </label>
    </div>
  );
}
