import { redirect } from "next/navigation";
import { ResultsBrowser } from "@/components/results-browser";
import { ResultsEditor } from "@/components/results-editor";
import { ResultsAnalytics } from "@/components/results-analytics";
import { StudentAnalyticsPanel } from "@/components/student-analytics";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { computeClassAnalytics, computeStudentAnalytics, distinctTerms } from "@/lib/results-analytics";

export default async function ConsoleResults({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; student?: string; term?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const { class: classId, student: studentId, term: termParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("class_sections").select("id, grade, section").order("grade").order("section"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);

  const { data: students } = classId
    ? await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("class_section_id", classId)
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
    classId && !validStudent && activeTerm
      ? computeClassAnalytics(classResults ?? [], students ?? [], activeTerm)
      : null;
  const studentAnalytics = validStudent ? computeStudentAnalytics(results ?? []) : null;

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
        selectedClassId={classId ?? ""}
        selectedStudentId={validStudent ?? ""}
      />

      {validStudent && studentAnalytics ? (
        <StudentAnalyticsPanel analytics={studentAnalytics} />
      ) : (
        classId &&
        (classAnalytics ? (
          <ResultsAnalytics analytics={classAnalytics} classId={classId} term={activeTerm} />
        ) : (
          <p className="rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-sm text-slate">
            No marks entered for this class yet — pick a student below to add some.
          </p>
        ))
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
