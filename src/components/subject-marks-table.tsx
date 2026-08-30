"use client";

import { useState, useTransition } from "react";
import { saveSubjectMark } from "@/app/(staff)/console/results/subject/actions";
import { gradeForPercentage, type GradeBand } from "@/lib/grade-boundaries";
import { Button } from "./button";
import { useToast } from "./toast-provider";

export type SubjectMarksStudent = {
  id: string;
  firstName: string;
  lastName: string;
  rollNo: string;
  resultId: string | null;
  marks: number | null;
};

/**
 * One row per student for a single subject+term — the subject-teacher
 * counterpart to ResultsEditor's per-student, all-subjects table. Max marks
 * and grade are fixed by the subject's configured grading scheme
 * (GradeBoundariesEditor) rather than typed per row; grade is shown live as
 * the teacher types, then confirmed by the server on save.
 */
export function SubjectMarksTable({
  term,
  subject,
  maxMarks,
  bands,
  students,
}: {
  term: string;
  subject: string;
  maxMarks: number;
  bands: GradeBand[];
  students: SubjectMarksStudent[];
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[560px] text-left">
        <thead className="bg-maroon text-cream">
          <tr>
            <th className="px-3 py-2.5 font-heading text-sm font-normal">Roll no.</th>
            <th className="px-3 py-2.5 font-heading text-sm font-normal">Student</th>
            <th className="px-3 py-2.5 font-heading text-sm font-normal">Marks (out of {maxMarks})</th>
            <th className="px-3 py-2.5 font-heading text-sm font-normal">Grade</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {students.map((s) => (
            <SubjectMarksRow key={s.id} term={term} subject={subject} maxMarks={maxMarks} bands={bands} student={s} />
          ))}
        </tbody>
      </table>
      {students.length === 0 && (
        <p className="px-3 py-3 text-sm text-slate">No students in this class.</p>
      )}
    </div>
  );
}

function SubjectMarksRow({
  term,
  subject,
  maxMarks,
  bands,
  student,
}: {
  term: string;
  subject: string;
  maxMarks: number;
  bands: GradeBand[];
  student: SubjectMarksStudent;
}) {
  const [marks, setMarks] = useState(student.marks === null ? "" : String(student.marks));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const dirty = marks !== (student.marks === null ? "" : String(student.marks));
  const marksNum = Number(marks);
  const livePct = marks !== "" && Number.isFinite(marksNum) && maxMarks > 0 ? (marksNum / maxMarks) * 100 : null;
  const liveGrade = livePct === null ? null : gradeForPercentage(livePct, bands);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveSubjectMark({
          resultId: student.resultId ?? undefined,
          studentId: student.id,
          term,
          subject,
          marks: marksNum,
        });
        toast.success(`Saved ${student.firstName} ${student.lastName}'s mark`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't save";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <tr>
      <td className="px-3 py-2 text-sm text-slate-strong">{student.rollNo}</td>
      <td className="px-3 py-2 text-sm text-slate-strong">
        {student.firstName} {student.lastName}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          placeholder="—"
          className="w-24 rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        />
      </td>
      <td className="px-3 py-2 text-sm text-slate-strong">{liveGrade ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {dirty && marks !== "" && (
            <Button type="button" size="sm" onClick={save} loading={pending}>
              Save
            </Button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}
