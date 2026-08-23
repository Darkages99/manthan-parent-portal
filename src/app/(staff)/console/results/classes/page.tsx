import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";
import { computeClassAnalytics, distinctTerms, WEAK_THRESHOLD_PCT } from "@/lib/results-analytics";

export default async function ResultsByClass() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  const isPrincipal = isPrincipalRole(viewer.staff.role);
  if (!isPrincipal && viewer.staff.role !== "class_teacher") redirect("/console");

  const supabase = await createClient();

  const { data: allClassSections } = await supabase
    .from("class_sections")
    .select("id, grade, section")
    .order("grade")
    .order("section");
  const visibleClassIds = isPrincipal ? null : new Set(await getTaughtClassIds(supabase, viewer.staff.id));
  const classes = isPrincipal
    ? (allClassSections ?? [])
    : (allClassSections ?? []).filter((c) => visibleClassIds!.has(c.id));
  const classIds = classes.map((c) => c.id);

  const { data: students } = classIds.length
    ? await supabase
        .from("students")
        .select("id, first_name, last_name, class_section_id")
        .in("class_section_id", classIds)
    : { data: [] as { id: string; first_name: string; last_name: string; class_section_id: string }[] };
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: results } = studentIds.length
    ? await supabase
        .from("exam_results")
        .select("student_id, term, subject, marks, max_marks")
        .in("student_id", studentIds)
    : { data: [] as { student_id: string; term: string; subject: string; marks: number; max_marks: number }[] };

  const term = distinctTerms(results ?? [])[0] ?? null;

  const studentsByClass = new Map<string, { id: string; first_name: string; last_name: string }[]>();
  for (const s of students ?? []) {
    const arr = studentsByClass.get(s.class_section_id) ?? [];
    arr.push(s);
    studentsByClass.set(s.class_section_id, arr);
  }

  const rows = term
    ? classes.map((c) => {
        const classStudents = studentsByClass.get(c.id) ?? [];
        const classStudentIds = new Set(classStudents.map((s) => s.id));
        const classResults = (results ?? []).filter((r) => classStudentIds.has(r.student_id));
        const analytics = computeClassAnalytics(classResults, classStudents, term);
        return { id: c.id, label: `Grade ${c.grade} - ${c.section}`, analytics };
      })
    : [];

  const withMarks = rows.filter((r) => r.analytics.studentCount > 0);
  const weak = withMarks.filter((r) => r.analytics.classAveragePct < WEAK_THRESHOLD_PCT);
  const healthy = withMarks.filter((r) => r.analytics.classAveragePct >= WEAK_THRESHOLD_PCT);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/console/results" className="text-sm font-medium text-rust hover:underline">
          ← Results
        </Link>
        <p className="mt-2 font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Results by class</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          {term ? `Term ${term} — every class's average and pass rate.` : "No marks entered yet."}
        </p>
      </div>

      {weak.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-xl text-maroon">Needs attention (below {WEAK_THRESHOLD_PCT}%)</h2>
          <ClassCardGrid rows={weak} tone="warn" />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">All classes</h2>
        {healthy.length === 0 && weak.length === 0 ? (
          <p className="text-base text-slate">No marks entered yet.</p>
        ) : (
          <ClassCardGrid rows={healthy} />
        )}
      </section>
    </div>
  );
}

function ClassCardGrid({
  rows,
  tone,
}: {
  rows: { id: string; label: string; analytics: ReturnType<typeof computeClassAnalytics> }[];
  tone?: "warn";
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/console/results?class=${r.id}`}
            className={`block rounded-sm border p-4 shadow-[var(--shadow-card)] transition hover:border-rust/60 ${
              tone === "warn"
                ? "border-rose-300 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-900/20"
                : "border-hairline bg-surface"
            }`}
          >
            <p className="font-semibold text-maroon">{r.label}</p>
            <p className="mt-1 text-sm text-slate">
              {r.analytics.studentCount} students · {r.analytics.classAveragePct.toFixed(1)}% average ·{" "}
              {r.analytics.passRatePct.toFixed(0)}% pass rate
            </p>
            {r.analytics.belowFortyCount > 0 && (
              <p className="mt-1 text-sm font-semibold text-rose-600 dark:text-rose-300">
                {r.analytics.belowFortyCount} below 40%
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
