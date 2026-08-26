import { redirect } from "next/navigation";
import { ConsultationForm } from "@/components/consultation-form";
import { ConsultationList } from "@/components/consultation-list";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ConsultationsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);
  const { data: consultations } = await supabase
    .from("parent_consultations")
    .select("*")
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  const studentNames = Object.fromEntries(viewer.students.map((s) => [s.id, s.first_name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Meet the school</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Parent Consultations</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Need to talk to someone outside the usual PTM slots? Request a consultation for a Tuesday
          or Thursday and tell us when you&apos;re free — the front office will confirm a time.
        </p>
      </div>

      <ConsultationForm students={viewer.students} />

      <ConsultationList consultations={consultations ?? []} studentNames={studentNames} />
    </div>
  );
}
