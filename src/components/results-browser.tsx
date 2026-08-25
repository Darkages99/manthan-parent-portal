"use client";

import { useRouter } from "next/navigation";
import { ComboBox } from "./combobox";

type ClassLite = { id: string; grade: string; section: string };
type StudentLite = { id: string; first_name: string; last_name: string };

/** Class + student pickers that drive the Results page via the URL query. */
export function ResultsBrowser({
  classes,
  students,
  selectedClassId,
  selectedStudentId,
}: {
  classes: ClassLite[];
  students: StudentLite[];
  selectedClassId: string;
  selectedStudentId: string;
}) {
  const router = useRouter();

  function selectClass(classId: string) {
    router.push(classId ? `/console/results?class=${classId}` : "/console/results");
  }

  function selectStudent(studentId: string) {
    const base = `/console/results?class=${selectedClassId}`;
    router.push(studentId ? `${base}&student=${studentId}` : base);
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
          onChange={selectClass}
          placeholder="Select a class…"
          ariaLabel="Class"
          recallKey="results-class"
        />
      </label>

      <label className="flex w-56 flex-col gap-1 text-sm font-medium text-slate-strong">
        Student
        <ComboBox
          options={students.map((s) => ({
            value: s.id,
            label: `${s.first_name} ${s.last_name}`,
          }))}
          value={selectedStudentId}
          onChange={selectStudent}
          disabled={!selectedClassId}
          placeholder="Select a student…"
          ariaLabel="Student"
        />
      </label>
    </div>
  );
}
