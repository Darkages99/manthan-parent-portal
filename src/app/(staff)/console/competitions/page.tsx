import { redirect } from "next/navigation";
import { CompetitionsConsole } from "@/components/competitions-console";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleCompetitions() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const { data: competitions } = await supabase
    .from("competitions")
    .select("*")
    .order("registration_deadline", { ascending: true, nullsFirst: false })
    .order("exam_date", { ascending: true, nullsFirst: false });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Competitions &amp; Olympiads</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Maintain the registration info and updates parents see for external exams — NSO, IMO, IEO,
          Asset exams and the like.
        </p>
      </div>

      <CompetitionsConsole competitions={competitions ?? []} />
    </div>
  );
}
