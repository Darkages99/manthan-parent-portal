"use client";

import { useRouter } from "next/navigation";
import { ComboBox } from "./combobox";
import { TERM_OPTIONS } from "@/lib/grades";

type ClassLite = { id: string; grade: string; section: string };

/** Subject + term + class pickers that drive the subject-focused results
 *  entry page via the URL query. Class options are already scoped to the
 *  selected subject by the server (page.tsx), so this component just wires
 *  navigation — it doesn't re-derive scope. */
export function SubjectResultsBrowser({
  subjects,
  classes,
  selectedSubject,
  selectedTerm,
  selectedClassId,
}: {
  subjects: string[];
  classes: ClassLite[];
  selectedSubject: string;
  selectedTerm: string;
  selectedClassId: string;
}) {
  const router = useRouter();

  function navigate(subject: string, term: string, classId: string) {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (term) params.set("term", term);
    if (classId) params.set("class", classId);
    const qs = params.toString();
    router.push(qs ? `/console/results/subject?${qs}` : "/console/results/subject");
  }

  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex w-56 flex-col gap-1 text-sm font-medium text-slate-strong">
        Subject
        <ComboBox
          options={subjects.map((s) => ({ value: s, label: s }))}
          value={selectedSubject}
          onChange={(subject) => navigate(subject, selectedTerm, "")}
          placeholder="Select a subject…"
          ariaLabel="Subject"
          recallKey="subject-results-subject"
        />
      </label>

      <label className="flex w-56 flex-col gap-1 text-sm font-medium text-slate-strong">
        Term
        <ComboBox
          options={TERM_OPTIONS.map((t) => ({ value: t, label: t }))}
          value={selectedTerm}
          onChange={(term) => navigate(selectedSubject, term, selectedClassId)}
          disabled={!selectedSubject}
          placeholder="Select a term…"
          ariaLabel="Term"
        />
      </label>

      <label className="flex w-56 flex-col gap-1 text-sm font-medium text-slate-strong">
        Class
        <ComboBox
          options={classes.map((c) => ({
            value: c.id,
            label: `Grade ${c.grade}-${c.section}`,
          }))}
          value={selectedClassId}
          onChange={(classId) => navigate(selectedSubject, selectedTerm, classId)}
          disabled={!selectedSubject || !selectedTerm}
          placeholder="Select a class…"
          ariaLabel="Class"
        />
      </label>
    </div>
  );
}
