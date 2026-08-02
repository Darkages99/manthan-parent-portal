import { redirect } from "next/navigation";
import { TimetableConsole } from "@/components/timetable-console";
import { PeriodEditor } from "@/components/period-editor";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { sortPeriods } from "@/lib/timetable";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleTimetable() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const canEdit = isPrincipalRole(viewer.staff.role);
  const supabase = await createClient();

  const [{ data: periods }, { data: classes }, { data: subjects }, { data: teachers }, { data: entries }] =
    await Promise.all([
      supabase.from("timetable_periods").select("*"),
      supabase.from("class_sections").select("id, grade, section").order("grade").order("section"),
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("staff").select("id, name").order("name"),
      supabase.from("timetable_entries").select("*"),
    ]);

  const orderedPeriods = sortPeriods(periods ?? []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Scheduling</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Timetable</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          {canEdit
            ? "Build each class's weekly timetable. Assign a subject and teacher to every period; clashes are flagged automatically."
            : "Your personal weekly schedule, and the timetable of any class."}
        </p>
      </div>

      {canEdit && <PeriodEditor periods={periods ?? []} />}

      <TimetableConsole
        canEdit={canEdit}
        periods={orderedPeriods}
        classes={classes ?? []}
        subjects={subjects ?? []}
        teachers={teachers ?? []}
        initialEntries={entries ?? []}
        myStaffId={viewer.staff.id}
      />
    </div>
  );
}
