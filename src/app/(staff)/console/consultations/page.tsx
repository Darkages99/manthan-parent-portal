import { redirect } from "next/navigation";
import { ConsultationDecisionList } from "@/components/consultation-decision-list";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function StaffConsultations() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const canDecide = viewer.staff.role === "front_office" || isPrincipalRole(viewer.staff.role);

  const supabase = await createClient();
  const [{ data: consultations }, { data: students }, { data: guardians }] = await Promise.all([
    supabase.from("parent_consultations").select("*").order("created_at", { ascending: false }),
    supabase.from("students").select("id, first_name, last_name"),
    supabase.from("guardians").select("id, name"),
  ]);

  const studentNames = Object.fromEntries((students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));

  const all = consultations ?? [];
  const pending = all.filter((c) => c.status === "pending");
  const decided = all.filter((c) => c.status !== "pending");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Meet the school</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Parent Consultations</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Off-cycle meeting requests parents raised for a Tuesday or Thursday.{" "}
          {canDecide ? "Schedule a time or decline." : "Front office or the principal decides these."}
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">
          Awaiting decision{pending.length > 0 && ` · ${pending.length}`}
        </h2>
        <ConsultationDecisionList
          consultations={pending}
          studentNames={studentNames}
          guardianNames={guardianNames}
          canDecide={canDecide}
          emptyLabel="Nothing awaiting a decision."
        />
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Past requests</h2>
        <ConsultationDecisionList
          consultations={decided}
          studentNames={studentNames}
          guardianNames={guardianNames}
          canDecide={canDecide}
          emptyLabel="No decided requests yet."
        />
      </section>
    </div>
  );
}
