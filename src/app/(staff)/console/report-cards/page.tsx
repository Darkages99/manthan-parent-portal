import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";
import { TERM_OPTIONS } from "@/lib/grades";
import { ReportCardBrowser } from "@/components/report-card-browser";
import { ReportCardRow } from "@/components/report-card-row";
import { ReportCardBulkUpload } from "@/components/report-card-bulk-upload";

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  const isPrincipal = isPrincipalRole(viewer.staff.role);
  const canSeeEveryClass = isPrincipal || viewer.staff.role === "front_office";
  if (!canSeeEveryClass && viewer.staff.role !== "class_teacher") redirect("/console");

  const { class: classId, term: termParam } = await searchParams;
  const supabase = await createClient();

  const { data: allClassSections } = await supabase
    .from("class_sections")
    .select("id, grade, section")
    .order("grade")
    .order("section");
  const taughtClassIds = canSeeEveryClass ? null : new Set(await getTaughtClassIds(supabase, viewer.staff.id));
  const scopedClasses = canSeeEveryClass
    ? (allClassSections ?? [])
    : (allClassSections ?? []).filter((c) => taughtClassIds!.has(c.id));

  const validClassId = scopedClasses.some((c) => c.id === classId) ? classId : undefined;
  const validTerm = TERM_OPTIONS.includes(termParam ?? "") ? termParam : undefined;

  const { data: students } = validClassId
    ? await supabase
        .from("students")
        .select("id, first_name, last_name, roll_no")
        .eq("class_section_id", validClassId)
        .order("roll_no")
    : { data: [] as { id: string; first_name: string; last_name: string; roll_no: string }[] };
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: results } =
    studentIds.length && validTerm
      ? await supabase
          .from("exam_results")
          .select("student_id, report_card_pdf_url")
          .in("student_id", studentIds)
          .eq("term", validTerm)
      : { data: [] as { student_id: string; report_card_pdf_url: string | null }[] };
  const urlByStudent = new Map<string, string | null>();
  for (const r of results ?? []) {
    if (r.report_card_pdf_url) urlByStudent.set(r.student_id, r.report_card_pdf_url);
    else if (!urlByStudent.has(r.student_id)) urlByStudent.set(r.student_id, null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Report cards</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Pick a class and term to publish report card PDFs — one at a time, or mass upload a whole
          class at once by matching each file to a student.
        </p>
      </div>

      <ReportCardBrowser
        classes={scopedClasses}
        selectedClassId={validClassId ?? ""}
        selectedTerm={validTerm ?? ""}
      />

      {validClassId && validTerm && (
        <>
          <ReportCardBulkUpload classId={validClassId} term={validTerm} />

          <div className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="font-heading text-base text-maroon">
              {students?.length ?? 0} student{(students?.length ?? 0) === 1 ? "" : "s"}
            </p>
            {(students ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate">No students in this class.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {(students ?? []).map((s) => (
                  <ReportCardRow
                    key={s.id}
                    studentId={s.id}
                    term={validTerm}
                    url={urlByStudent.get(s.id) ?? null}
                    studentName={`${s.first_name} ${s.last_name}`}
                    rollNo={s.roll_no}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
