import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { TERM_OPTIONS } from "@/lib/grades";
import { canEditSubject, getEditableSubjects, getEditableSubjectsByClass } from "@/lib/results-scope";
import { getSubjectGradingConfig } from "@/lib/grade-boundaries";
import { SubjectResultsBrowser } from "@/components/subject-results-browser";
import { GradeBoundariesEditor } from "@/components/grade-boundaries-editor";
import { SubjectMarksTable, type SubjectMarksStudent } from "@/components/subject-marks-table";
import { SubjectMarksCsvImport } from "@/components/subject-marks-csv-import";

/**
 * Subject-first companion to /console/results: pick a subject + term once,
 * configure its max marks and grade boundaries in one place, then enter
 * marks for every student in a class without re-picking subject/max/grade
 * per row. /console/results stays the per-student, all-subjects view.
 */
export default async function SubjectResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; term?: string; class?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  const isPrincipal = isPrincipalRole(viewer.staff.role);
  if (!isPrincipal && viewer.staff.role !== "class_teacher") redirect("/console");

  const { subject: subjectParam, term: termParam, class: classParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: allSubjects }, { data: allClassSections }] = await Promise.all([
    supabase.from("subjects").select("name").order("name"),
    supabase.from("class_sections").select("id, grade, section").order("grade").order("section"),
  ]);

  const editableSubjectScope = isPrincipal ? "all" : await getEditableSubjects(supabase, viewer.staff.id);
  const subjectOptions =
    editableSubjectScope === "all" ? (allSubjects ?? []).map((s) => s.name) : [...editableSubjectScope];

  const validSubject = subjectOptions.includes(subjectParam ?? "") ? subjectParam : undefined;
  const validTerm = TERM_OPTIONS.includes(termParam ?? "") ? termParam : undefined;

  const subjectScopeByClass = isPrincipal ? null : await getEditableSubjectsByClass(supabase, viewer.staff.id);
  const classes = (allClassSections ?? []).filter((c) => {
    if (!validSubject) return false;
    if (isPrincipal) return true;
    return canEditSubject(subjectScopeByClass!.get(c.id), validSubject);
  });
  const validClassId = classes.some((c) => c.id === classParam) ? classParam : undefined;

  const config =
    validSubject && validTerm ? await getSubjectGradingConfig(supabase, validSubject, validTerm) : null;

  let tableStudents: SubjectMarksStudent[] = [];
  if (validSubject && validTerm && validClassId) {
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_no")
      .eq("class_section_id", validClassId)
      .order("roll_no");
    const studentIds = (students ?? []).map((s) => s.id);
    const { data: results } = studentIds.length
      ? await supabase
          .from("exam_results")
          .select("id, student_id, marks")
          .in("student_id", studentIds)
          .eq("term", validTerm)
          .eq("subject", validSubject)
      : { data: [] as { id: string; student_id: string; marks: number }[] };
    const resultByStudent = new Map((results ?? []).map((r) => [r.student_id, r]));

    tableStudents = (students ?? []).map((s) => {
      const r = resultByStudent.get(s.id);
      return {
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        rollNo: s.roll_no,
        resultId: r?.id ?? null,
        marks: r?.marks ?? null,
      };
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Results by subject</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Pick a subject and term to set its max marks and grade boundaries once, then enter marks for a whole
          class — or import them from a CSV.
        </p>
      </div>

      <SubjectResultsBrowser
        subjects={subjectOptions}
        classes={classes}
        selectedSubject={validSubject ?? ""}
        selectedTerm={validTerm ?? ""}
        selectedClassId={validClassId ?? ""}
      />

      {validSubject && validTerm && config && (
        <GradeBoundariesEditor
          subject={validSubject}
          term={validTerm}
          initialMaxMarks={config.maxMarks}
          initialBands={config.bands}
        />
      )}

      {validSubject && validTerm && validClassId && config && (
        <>
          <SubjectMarksCsvImport classId={validClassId} subject={validSubject} term={validTerm} />
          <SubjectMarksTable
            term={validTerm}
            subject={validSubject}
            maxMarks={config.maxMarks}
            bands={config.bands}
            students={tableStudents}
          />
        </>
      )}

      {(!validSubject || !validTerm) && (
        <p className="rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-sm text-slate">
          Pick a subject and term above to get started.
        </p>
      )}
    </div>
  );
}
