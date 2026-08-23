import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { HomeworkSubmissionList } from "@/components/homework-submission-list";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function HomeworkSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const { id } = await params;
  const supabase = await createClient();

  const { data: homework } = await supabase
    .from("homework_assignments")
    .select("*, class_sections(grade, section), subjects(name)")
    .eq("id", id)
    .maybeSingle();
  if (!homework) notFound();

  if (viewer.staff.role === "class_teacher") {
    const { data: cls } = await supabase
      .from("class_sections")
      .select("class_teacher_id")
      .eq("id", homework.class_section_id)
      .single();
    if (cls?.class_teacher_id !== viewer.staff.id) redirect("/console/homework");
  }

  const [{ data: students }, { data: submissions }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("class_section_id", homework.class_section_id)
      .order("roll_no"),
    supabase.from("homework_submissions").select("student_id").eq("homework_id", id),
  ]);
  const notSubmittedIds = new Set((submissions ?? []).map((s) => s.student_id));

  const cls = homework.class_sections as { grade: string; section: string } | null;
  const subject = homework.subjects as { name: string } | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/console/homework" className="text-sm font-medium text-rust hover:underline">
          ← Homework
        </Link>
        <p className="mt-2 font-heading text-sm uppercase tracking-[0.18em] text-rust">
          {cls ? `Grade ${cls.grade}-${cls.section}` : "Class"}
          {subject && ` · ${subject.name}`}
        </p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">{homework.title}</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Due {homework.due_date} — ticked means submitted. Unticked students&apos; guardians are
          notified.
        </p>
      </div>

      <HomeworkSubmissionList
        homeworkId={homework.id}
        students={students ?? []}
        notSubmittedIds={[...notSubmittedIds]}
      />
    </div>
  );
}
