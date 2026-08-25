import { redirect } from "next/navigation";
import { HomeworkConsole } from "@/components/homework-console";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/** Today's date in IST as YYYY-MM-DD. */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function ConsoleHomework() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const today = istToday();

  // Class teachers see/manage only their own class(es); principal / office roles see any class.
  const { data: allClasses } = await supabase
    .from("class_sections")
    .select("*")
    .order("grade")
    .order("section");
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);
  const classIds = classes.map((c) => c.id);

  const [{ data: subjects }, { data: homework }] = await Promise.all([
    supabase.from("subjects").select("id, name").order("name"),
    classIds.length
      ? supabase
          .from("homework_assignments")
          .select("*")
          .in("class_section_id", classIds)
          .order("due_date")
      : Promise.resolve({ data: [] as Tables<"homework_assignments">[] }),
  ]);

  // notSubmittedCounts respects each assignment's `checked` default (see
  // migration 0036): a homework_submissions row is an override, not an
  // absolute "not done" marker, so the count differs depending on `checked`.
  const allHomeworkIds = (homework ?? []).map((h) => h.id);
  const [{ data: overrideRows }, { data: roster }] = await Promise.all([
    allHomeworkIds.length
      ? supabase.from("homework_submissions").select("homework_id").in("homework_id", allHomeworkIds)
      : Promise.resolve({ data: [] as { homework_id: string }[] }),
    classIds.length
      ? supabase.from("students").select("id, class_section_id").in("class_section_id", classIds)
      : Promise.resolve({ data: [] as { id: string; class_section_id: string }[] }),
  ]);
  const overrideCounts: Record<string, number> = {};
  for (const r of overrideRows ?? []) {
    overrideCounts[r.homework_id] = (overrideCounts[r.homework_id] ?? 0) + 1;
  }
  const rosterSizeByClass: Record<string, number> = {};
  for (const s of roster ?? []) {
    rosterSizeByClass[s.class_section_id] = (rosterSizeByClass[s.class_section_id] ?? 0) + 1;
  }
  const notSubmittedCounts: Record<string, number> = {};
  for (const h of homework ?? []) {
    const overridden = overrideCounts[h.id] ?? 0;
    notSubmittedCounts[h.id] = h.checked
      ? overridden
      : (rosterSizeByClass[h.class_section_id] ?? 0) - overridden;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Academics</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Homework</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Set homework for a class and subject, with a due date parents can see immediately.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="text-base text-slate">No class is assigned to you.</p>
      ) : (
        <HomeworkConsole
          classes={classes}
          subjects={subjects ?? []}
          homework={homework ?? []}
          notSubmittedCounts={notSubmittedCounts}
          today={today}
        />
      )}
    </div>
  );
}
