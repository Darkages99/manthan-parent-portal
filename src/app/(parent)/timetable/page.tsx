import { redirect } from "next/navigation";
import { ParentTimetable } from "@/components/parent-timetable";
import { type GridCell } from "@/components/timetable-grid";
import { getViewer } from "@/lib/session";
import { cellKey, sortPeriods } from "@/lib/timetable";
import { createClient } from "@/lib/supabase/server";

export default async function ParentTimetablePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const classIds = Array.from(
    new Set(viewer.students.map((s) => s.class_section_id).filter(Boolean))
  );

  const supabase = await createClient();
  const [{ data: periods }, { data: subjects }, { data: teachers }, { data: entries }] =
    await Promise.all([
      supabase.from("timetable_periods").select("*"),
      supabase.from("subjects").select("id, name"),
      supabase.from("staff_directory").select("id, name"),
      classIds.length > 0
        ? supabase.from("timetable_entries").select("*").in("class_section_id", classIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.name]));

  // Precompute the grid cells for each of the guardian's children's classes.
  const cellsByClass: Record<string, Record<string, GridCell>> = {};
  for (const e of entries ?? []) {
    const map = (cellsByClass[e.class_section_id] ??= {});
    map[cellKey(e.day_of_week, e.period_id)] = {
      primary: (e.subject_id && subjectName.get(e.subject_id)) || "—",
      secondary: (e.teacher_id && teacherName.get(e.teacher_id)) || undefined,
    };
  }

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
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Timetable</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          The weekly class timetable, Monday to Saturday.
        </p>
      </div>

      <ParentTimetable students={students} periods={sortPeriods(periods ?? [])} cellsByClass={cellsByClass} />
    </div>
  );
}
