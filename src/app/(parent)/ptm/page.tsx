import { redirect } from "next/navigation";
import { PtmView } from "@/components/ptm-view";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function PtmPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const classIds = Array.from(
    new Set(viewer.students.map((s) => s.classSection?.id).filter((id): id is string => !!id))
  );

  // Only surface slots whose parent meeting is still open — a closed meeting
  // shouldn't show as bookable even if some of its slots are unclaimed.
  const [{ data: slots }, { data: teachers }] = await Promise.all([
    supabase
      .from("ptm_slots")
      .select("*, ptm_meetings!inner(status)")
      .in("class_section_id", classIds)
      .eq("ptm_meetings.status", "open"),
    supabase.from("staff").select("id, name"),
  ]);

  const teacherNames = Object.fromEntries((teachers ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Book a meeting</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">PTM booking</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Pick a time slot the class teacher has opened for the next parent–teacher meeting.
        </p>
      </div>

      <PtmView students={viewer.students} slots={slots ?? []} teacherNames={teacherNames} />
    </div>
  );
}
