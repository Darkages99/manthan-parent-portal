import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchAttendanceForDate } from "@/lib/attendance-today";
import { AlertTriangleIcon } from "@/components/icons";
import { NotifyTeacherButton } from "@/components/notify-teacher-button";
import { isPrincipalRole } from "@/lib/roles";
import type { Enums } from "@/lib/supabase/database.types";

type Status = Enums<"attendance_status">;

/** Today's date in IST as YYYY-MM-DD (matches how attendance is marked). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function AttendanceByClass() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const today = istToday();

  const { data: allClasses } = await supabase
    .from("class_sections")
    .select("*")
    .order("grade")
    .order("section");
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);
  const classIds = classes.map((c) => c.id);

  const { data: students } = classIds.length
    ? await supabase.from("students").select("id, class_section_id").in("class_section_id", classIds)
    : { data: [] as { id: string; class_section_id: string }[] };
  const studentIds = (students ?? []).map((s) => s.id);

  const records = await fetchAttendanceForDate(supabase, today, studentIds);

  const studentsByClass = new Map<string, string[]>();
  for (const s of students ?? []) {
    const arr = studentsByClass.get(s.class_section_id) ?? [];
    arr.push(s.id);
    studentsByClass.set(s.class_section_id, arr);
  }
  const statusByStudent = new Map((records ?? []).map((r) => [r.student_id, r.status]));

  const rows = classes.map((c) => {
    const studentIds = studentsByClass.get(c.id) ?? [];
    const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, half_day: 0 };
    let marked = 0;
    for (const sid of studentIds) {
      const status = statusByStudent.get(sid);
      if (status) {
        counts[status] += 1;
        marked += 1;
      }
    }
    return {
      id: c.id,
      label: `Grade ${c.grade} - ${c.section}`,
      total: studentIds.length,
      marked,
      counts,
      classTeacherId: c.class_teacher_id,
    };
  });

  const canManage = isPrincipalRole(viewer.staff.role);

  const unmarked = rows.filter((r) => r.total > 0 && r.marked === 0);
  const markedOrEmpty = rows.filter((r) => r.total === 0 || r.marked > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/console/attendance" className="text-sm font-medium text-rust hover:underline">
          ← Attendance
        </Link>
        <p className="mt-2 font-heading text-sm uppercase tracking-[0.18em] text-rust">Register</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Attendance by class</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Today, {today} — every class&apos;s marking status and headcount.
        </p>
      </div>

      {unmarked.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-xl text-maroon">
            <AlertTriangleIcon className="h-5 w-5 text-rose-600" />
            Not marked yet
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unmarked.map((r) => (
              <li
                key={r.id}
                className="rounded-sm border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/50 dark:bg-rose-900/20"
              >
                <p className="flex items-center gap-1.5 font-semibold text-maroon">
                  <AlertTriangleIcon className="h-4 w-4 text-rose-600" />
                  {r.label}
                </p>
                <p className="mt-1 text-sm text-slate-strong">{r.total} students · not marked</p>
                {canManage && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.classTeacherId && <NotifyTeacherButton classSectionId={r.id} />}
                    <Link
                      href={`/console/attendance?classId=${r.id}&mark=1`}
                      className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong"
                    >
                      Mark manually
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Marked</h2>
        {markedOrEmpty.length === 0 ? (
          <p className="text-base text-slate">No classes to show.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markedOrEmpty.map((r) => (
              <li
                key={r.id}
                className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-semibold text-maroon">{r.label}</p>
                <p className="mt-1 text-sm text-slate">
                  {r.total === 0 ? "No students" : `${r.marked} of ${r.total} marked`}
                </p>
                {r.total > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="font-heading text-lg text-maroon">{r.counts.present}</p>
                      <p className="text-xs uppercase text-slate">Present</p>
                    </div>
                    <div>
                      <p className="font-heading text-lg text-maroon">{r.counts.absent}</p>
                      <p className="text-xs uppercase text-slate">Absent</p>
                    </div>
                    <div>
                      <p className="font-heading text-lg text-maroon">{r.counts.late}</p>
                      <p className="text-xs uppercase text-slate">Late</p>
                    </div>
                    <div>
                      <p className="font-heading text-lg text-maroon">{r.counts.half_day}</p>
                      <p className="text-xs uppercase text-slate">Half day</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
