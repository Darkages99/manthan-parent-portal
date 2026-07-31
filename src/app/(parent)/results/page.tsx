import { redirect } from "next/navigation";
import { ResultsView } from "@/components/results-view";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function ResultsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);
  const { data: results } = await supabase
    .from("exam_results")
    .select("*")
    .in("student_id", studentIds);

  const resultsByStudent: Record<string, Tables<"exam_results">[]> = {};
  for (const id of studentIds) resultsByStudent[id] = [];
  for (const r of results ?? []) resultsByStudent[r.student_id]?.push(r);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Results</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Term-wise marks and grades for each subject, with the report card available once the
          school publishes it.
        </p>
      </div>

      <ResultsView students={viewer.students} resultsByStudent={resultsByStudent} />
    </div>
  );
}
