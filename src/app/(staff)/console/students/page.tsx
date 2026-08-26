import { redirect } from "next/navigation";
import { StudentsManager } from "@/components/students-manager";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleStudents() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const [{ data: students }, { data: classes }, { data: links }, { data: guardians }] = await Promise.all([
    supabase.from("students").select("*").order("first_name"),
    supabase.from("class_sections").select("id, grade, section").order("grade").order("section"),
    supabase.from("guardian_student").select("student_id, guardian_id"),
    supabase.from("guardians").select("id, name"),
  ]);

  const guardianName = new Map((guardians ?? []).map((g) => [g.id, g.name]));
  const guardianNamesByStudent = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = guardianNamesByStudent.get(l.student_id) ?? [];
    const name = guardianName.get(l.guardian_id);
    if (name) arr.push(name);
    guardianNamesByStudent.set(l.student_id, arr);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Students</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Every enrolled student — search by name, roll number or class. Add, edit or remove a student
          here.
        </p>
      </div>

      <StudentsManager
        students={students ?? []}
        classes={classes ?? []}
        guardians={guardians ?? []}
        guardianNamesByStudent={Object.fromEntries(guardianNamesByStudent)}
      />
    </div>
  );
}
