import { redirect } from "next/navigation";
import { HomeworkView } from "@/components/homework-view";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function ParentHomeworkPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const classIds = Array.from(
    new Set(viewer.students.map((s) => s.class_section_id).filter((id): id is string => Boolean(id)))
  );

  const supabase = await createClient();
  const [{ data: homework }, { data: subjects }] = await Promise.all([
    classIds.length > 0
      ? supabase
          .from("homework_assignments")
          .select("*")
          .in("class_section_id", classIds)
          .order("due_date")
      : Promise.resolve({ data: [] as Tables<"homework_assignments">[] }),
    supabase.from("subjects").select("id, name"),
  ]);

  const subjectName = Object.fromEntries((subjects ?? []).map((s) => [s.id, s.name]));

  const homeworkByClass: Record<string, Tables<"homework_assignments">[]> = {};
  for (const id of classIds) homeworkByClass[id] = [];
  for (const h of homework ?? []) (homeworkByClass[h.class_section_id] ??= []).push(h);

  const students = viewer.students.map((s) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    classSectionId: s.class_section_id,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Homework</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          What&apos;s assigned, by subject, and when it&apos;s due.
        </p>
      </div>

      <HomeworkView students={students} homeworkByClass={homeworkByClass} subjectName={subjectName} />
    </div>
  );
}
