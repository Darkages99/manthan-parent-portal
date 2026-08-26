import { redirect } from "next/navigation";
import { DtrFilterView } from "@/components/dtr-filter-view";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleCalendar() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("dtr_events")
    .select("*")
    .order("event_date", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">School calendar</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Dates to Remember</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Exams, holidays, events and deadlines across the school.
        </p>
      </div>

      <DtrFilterView events={events ?? []} />
    </div>
  );
}
