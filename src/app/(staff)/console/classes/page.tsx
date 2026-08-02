import { redirect } from "next/navigation";
import { ClassTeacherAssigner } from "@/components/class-teacher-assigner";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleClasses() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const [{ data: classes }, { data: staff }] = await Promise.all([
    supabase.from("class_sections").select("*").order("grade").order("section"),
    supabase.from("staff").select("id, name, role").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Classes</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Assign a class teacher to each section. The class teacher owns the section&apos;s
          attendance, PTMs and stay-back approvals.
        </p>
      </div>

      <ClassTeacherAssigner classes={classes ?? []} staff={staff ?? []} />
    </div>
  );
}
