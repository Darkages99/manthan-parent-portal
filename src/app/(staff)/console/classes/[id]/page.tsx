import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ClassDetail } from "@/components/class-detail";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/reference-data";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const [
    { data: cls },
    { data: allClasses },
    { data: staff },
    subjects,
    { data: classSubjectTeachers },
    { data: students },
  ] = await Promise.all([
    supabase.from("class_sections").select("*").eq("id", id).maybeSingle(),
    supabase.from("class_sections").select("id, grade, section, academic_year").order("grade").order("section"),
    supabase.from("staff").select("id, name, role").order("name"),
    getSubjects(),
    supabase.from("class_subject_teachers").select("*").eq("class_section_id", id),
    supabase.from("students").select("*").eq("class_section_id", id).order("roll_no"),
  ]);

  if (!cls) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/console/classes" className="text-sm font-medium text-rust hover:underline">
          ← All classes
        </Link>
        <p className="mt-2 font-heading text-sm uppercase tracking-[0.18em] text-rust">
          {cls.academic_year}
        </p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">
          Grade {cls.grade} - {cls.section}
        </h1>
      </div>

      <ClassDetail
        cls={cls}
        otherClasses={(allClasses ?? []).filter((c) => c.id !== id)}
        staff={staff ?? []}
        subjects={subjects}
        classSubjectTeachers={classSubjectTeachers ?? []}
        students={students ?? []}
      />
    </div>
  );
}
