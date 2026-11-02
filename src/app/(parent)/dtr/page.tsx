import { redirect } from "next/navigation";
import { DtrFilterView } from "@/components/dtr-filter-view";
import { eventsForGuardian } from "@/lib/dtr-visibility";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function DTRPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);
  const [{ data: events }, { data: eventClasses }, { data: eventGroups }, { data: groupMemberships }] =
    await Promise.all([
      supabase.from("dtr_events").select("*").order("event_date", { ascending: true }),
      supabase.from("dtr_event_classes").select("*"),
      supabase.from("dtr_event_groups").select("*"),
      supabase.from("custom_group_students").select("custom_group_id").in("student_id", studentIds),
    ]);

  const visibleEvents = eventsForGuardian(
    events ?? [],
    eventClasses ?? [],
    eventGroups ?? [],
    new Set(viewer.students.map((s) => s.classSection?.id).filter((id): id is string => !!id)),
    new Set((groupMemberships ?? []).map((m) => m.custom_group_id))
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">School calendar</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Dates to Remember</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Exams, holidays, events and deadlines for your children&apos;s classes.
        </p>
      </div>

      <DtrFilterView events={visibleEvents} />
    </div>
  );
}
