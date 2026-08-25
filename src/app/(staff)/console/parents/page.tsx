import { redirect } from "next/navigation";
import { GuardiansManager } from "@/components/guardians-manager";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleParents() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const [{ data: guardians }, { data: links }, { data: students }, { data: classes }] = await Promise.all([
    supabase.from("guardians").select("*").order("name"),
    supabase.from("guardian_student").select("guardian_id, student_id"),
    supabase.from("students").select("id, first_name, last_name, roll_no, class_section_id").order("first_name"),
    supabase.from("class_sections").select("id, grade, section"),
  ]);

  const classById = new Map((classes ?? []).map((c) => [c.id, c]));
  const studentOptions = (students ?? []).map((s) => {
    const cls = classById.get(s.class_section_id);
    return {
      id: s.id,
      label: `${s.first_name} ${s.last_name}`,
      sublabel: cls ? `Grade ${cls.grade}-${cls.section} · Roll ${s.roll_no}` : s.roll_no,
    };
  });
  const studentLabelById = new Map(studentOptions.map((s) => [s.id, s.label]));

  const childIdsByGuardian = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = childIdsByGuardian.get(l.guardian_id) ?? [];
    arr.push(l.student_id);
    childIdsByGuardian.set(l.guardian_id, arr);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Parents</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Every guardian account — search by name, mobile or email. The email you set here is what a
          parent uses to activate their own login.
        </p>
      </div>

      <GuardiansManager
        guardians={guardians ?? []}
        studentOptions={studentOptions}
        studentLabelById={Object.fromEntries(studentLabelById)}
        childIdsByGuardian={Object.fromEntries(childIdsByGuardian)}
      />
    </div>
  );
}
