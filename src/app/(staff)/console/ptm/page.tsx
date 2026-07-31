import { redirect } from "next/navigation";
import { PtmSlotManager } from "@/components/ptm-slot-manager";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function StaffPtm() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const { data: allClasses } = await supabase.from("class_sections").select("*").order("grade");
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);

  const classIds = classes.map((c) => c.id);
  const [{ data: slots }, { data: students }, { data: guardians }] = await Promise.all([
    supabase.from("ptm_slots").select("*"),
    supabase.from("students").select("id, first_name, last_name"),
    supabase.from("guardians").select("id, name"),
  ]);

  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Meetings</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">PTM slots</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Open time slots for parents to book, and see who&apos;s signed up.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="text-base text-slate">No class is assigned to you.</p>
      ) : (
        <PtmSlotManager
          classes={classes}
          slots={(slots ?? []).filter((s) => classIds.includes(s.class_section_id))}
          studentNames={studentNames}
          guardianNames={guardianNames}
        />
      )}
    </div>
  );
}
