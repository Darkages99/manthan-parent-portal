import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ClassCardMenu } from "@/components/class-card-menu";
import { ClassIcon } from "@/components/icons";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleClasses() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const [{ data: classes }, { data: studentCounts }, { data: teacherCounts }, { data: staff }] =
    await Promise.all([
      supabase.from("class_sections").select("*").order("grade").order("section"),
      supabase.from("students").select("class_section_id"),
      supabase.from("class_subject_teachers").select("class_section_id"),
      supabase.from("staff").select("id, name").order("name"),
    ]);

  const studentCountByClass = new Map<string, number>();
  for (const s of studentCounts ?? []) {
    studentCountByClass.set(s.class_section_id, (studentCountByClass.get(s.class_section_id) ?? 0) + 1);
  }
  const teacherCountByClass = new Map<string, number>();
  for (const t of teacherCounts ?? []) {
    teacherCountByClass.set(t.class_section_id, (teacherCountByClass.get(t.class_section_id) ?? 0) + 1);
  }
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Classes</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Open a class to assign its class teacher, subjects and roster, or drag teachers and students
          onto another class.
        </p>
      </div>

      {(classes ?? []).length === 0 ? (
        <EmptyState
          icon={ClassIcon}
          title="No classes have been set up yet"
          detail="Classes are created from the roster sync."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(classes ?? []).map((c) => (
            <li key={c.id} className="relative">
              <Link
                href={`/console/classes/${c.id}`}
                className="flex h-full flex-col gap-2 rounded-sm border border-hairline bg-surface p-5 pr-11 shadow-[var(--shadow-card)] transition hover:border-rust/60"
              >
                <p className="font-heading text-lg text-maroon">
                  Grade {c.grade} - {c.section}
                </p>
                <p className="text-base text-slate-strong">
                  {c.class_teacher_id ? staffName.get(c.class_teacher_id) ?? "Class teacher" : "No class teacher assigned"}
                </p>
                <p className="mt-auto pt-2 text-sm text-slate-strong">
                  {studentCountByClass.get(c.id) ?? 0} students · {teacherCountByClass.get(c.id) ?? 0} subject teachers
                </p>
              </Link>
              <div className="absolute right-2 top-2">
                <ClassCardMenu classId={c.id} grade={c.grade} section={c.section} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
