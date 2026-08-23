import { redirect } from "next/navigation";
import { ResultsBrowser } from "@/components/results-browser";
import { ResultsEditor } from "@/components/results-editor";
import { ResultsAnalytics } from "@/components/results-analytics";
import { ResultsSchoolOverview, type ClassSummary } from "@/components/results-school-overview";
import { StudentAnalyticsPanel } from "@/components/student-analytics";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";
import { computeClassAnalytics, computeStudentAnalytics, distinctTerms } from "@/lib/results-analytics";

export default async function ConsoleResults({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; student?: string; term?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  const isPrincipal = isPrincipalRole(viewer.staff.role);
  if (!isPrincipal && viewer.staff.role !== "class_teacher") redirect("/console");

  const { class: classId, student: studentId, term: termParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: allClassSections }, { data: subjects }] = await Promise.all([
    supabase.from("class_sections").select("id, grade, section").order("grade").order("section"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);

  const visibleClassIds = isPrincipal
    ? null
    : new Set(await getTaughtClassIds(supabase, viewer.staff.id));
  const classes = isPrincipal
    ? (allClassSections ?? [])
    : (allClassSections ?? []).filter((c) => visibleClassIds!.has(c.id));
  const validClassId = classes.some((c) => c.id === classId) ? classId : undefined;

  const { data: students } = validClassId
    ? await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("class_section_id", validClassId)
        .order("roll_no")
    : { data: [] };

  // Only honour a selected student that actually belongs to the selected class.
  const validStudent = (students ?? []).some((s) => s.id === studentId) ? studentId : undefined;

  const { data: results } = validStudent
    ? await supabase
        .from("exam_results")
        .select("*")
        .eq("student_id", validStudent)
        .order("term", { ascending: false })
    : { data: [] };

  // Class-wide analytics are only needed when no single student is selected.
  const studentIds = (students ?? []).map((s) => s.id);
  const { data: classResults } =
    studentIds.length && !validStudent
      ? await supabase
          .from("exam_results")
          .select("student_id, term, subject, marks, max_marks")
          .in("student_id", studentIds)
      : { data: [] };

  const terms = distinctTerms(classResults ?? []);
  const activeTerm = terms.includes(termParam ?? "") ? (termParam as string) : terms[0];
  const classAnalytics =
    validClassId && !validStudent && activeTerm
      ? computeClassAnalytics(classResults ?? [], students ?? [], activeTerm)
      : null;
  const studentAnalytics = validStudent ? computeStudentAnalytics(results ?? []) : null;

  // Overview across every visible class — shown in place of a single class's
  // dashboard when nothing is selected yet (whole school for principal-tier
  // staff, the teacher's own classes otherwise).
  let overviewClasses: ClassSummary[] = [];
  let overviewTerm: string | null = null;
  if (!validClassId && classes.length > 0) {
    const classIds = classes.map((c) => c.id);
    const { data: allStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, class_section_id")
      .in("class_section_id", classIds);
    const allStudentIds = (allStudents ?? []).map((s) => s.id);
    const { data: allResults } = allStudentIds.length
      ? await supabase
          .from("exam_results")
          .select("student_id, term, subject, marks, max_marks")
          .in("student_id", allStudentIds)
      : { data: [] as { student_id: string; term: string; subject: string; marks: number; max_marks: number }[] };
    const overviewTerms = distinctTerms(allResults ?? []);
    overviewTerm = overviewTerms[0] ?? null;

    const studentsByClass = new Map<string, { id: string; first_name: string; last_name: string }[]>();
    for (const s of allStudents ?? []) {
      const arr = studentsByClass.get(s.class_section_id) ?? [];
      arr.push(s);
      studentsByClass.set(s.class_section_id, arr);
    }
    if (overviewTerm) {
      overviewClasses = classes
        .map((c) => {
          const classStudents = studentsByClass.get(c.id) ?? [];
          const classStudentIds = new Set(classStudents.map((s) => s.id));
          const results = (allResults ?? []).filter((r) => classStudentIds.has(r.student_id));
          const analytics = computeClassAnalytics(results, classStudents, overviewTerm!);
          return {
            id: c.id,
            label: `Grade ${c.grade}-${c.section}`,
            studentCount: analytics.studentCount,
            classAveragePct: analytics.classAveragePct,
            passRatePct: analytics.passRatePct,
            belowFortyCount: analytics.belowFortyCount,
            weakestSubject: analytics.weakestSubject,
          };
        })
        .filter((c) => c.studentCount > 0);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Results</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Pick a class and student to view or enter term marks. Saved marks appear in the parent
          portal immediately.
        </p>
      </div>

      <ResultsBrowser
        classes={classes ?? []}
        students={students ?? []}
        selectedClassId={validClassId ?? ""}
        selectedStudentId={validStudent ?? ""}
      />

      {validStudent && studentAnalytics ? (
        <StudentAnalyticsPanel analytics={studentAnalytics} />
      ) : validClassId ? (
        classAnalytics ? (
          <ResultsAnalytics analytics={classAnalytics} classId={validClassId} term={activeTerm} />
        ) : (
          <p className="rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-sm text-slate">
            No marks entered for this class yet — pick a student below to add some.
          </p>
        )
      ) : (
        <ResultsSchoolOverview
          scopeLabel={isPrincipal ? "Whole school" : "Your classes"}
          term={overviewTerm}
          classes={overviewClasses}
        />
      )}

      {validStudent && (
        <ResultsEditor
          studentId={validStudent}
          results={results ?? []}
          subjects={(subjects ?? []).map((s) => s.name)}
        />
      )}
    </div>
  );
}
