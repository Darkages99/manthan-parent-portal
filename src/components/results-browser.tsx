"use client";

import { useRouter } from "next/navigation";

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
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-strong">
        Class
        <select
          value={selectedClassId}
          onChange={(e) => selectClass(e.target.value)}
          className="w-56 rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong"
        >
          <option value="">— Select a class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Grade {c.grade}-{c.section}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-strong">
        Student
        <select
          value={selectedStudentId}
          disabled={!selectedClassId}
          onChange={(e) => selectStudent(e.target.value)}
          className="w-56 rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong disabled:opacity-60"
        >
          <option value="">— Select a student —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
