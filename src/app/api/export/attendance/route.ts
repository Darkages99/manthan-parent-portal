import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import type { Tables } from "@/lib/supabase/database.types";

// GET /api/export/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Exports the caller's visible attendance records as CSV, filtered on `date`.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();

  // Class teachers see their own class only; other staff roles see all.
  const { data: allClasses } = await supabase
    .from("class_sections")
    .select("id, grade, section, class_teacher_id");
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);
  const classIds = classes.map((c) => c.id);

  const { data: students } = classIds.length
    ? await supabase
        .from("students")
        .select("id, first_name, last_name, class_section_id")
        .in("class_section_id", classIds)
    : { data: [] as { id: string; first_name: string; last_name: string; class_section_id: string }[] };
  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) {
    return new Response(toCsv([]), {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="attendance-export.csv"',
      },
    });
  }

  // Page through the results — PostgREST caps a single response at 1000 rows,
  // and a whole-school export easily exceeds that, so fetch in ranges until a
  // short page signals the end.
  const PAGE = 1000;
  const records: Tables<"attendance_records">[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("attendance_records")
      .select("*")
      .in("student_id", studentIds)
      .order("date", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data: page, error } = await query;
    if (error) return new Response(error.message, { status: 500 });
    if (!page || page.length === 0) break;
    records.push(...page);
    if (page.length < PAGE) break;
  }

  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const classNames = Object.fromEntries(
    (allClasses ?? []).map((c) => [c.id, `Grade ${c.grade}-${c.section}`])
  );
  const classByStudent = Object.fromEntries((students ?? []).map((s) => [s.id, s.class_section_id]));

  const rows = records.map((r) => ({
    Date: r.date,
    "Student name": studentNames[r.student_id] ?? r.student_id,
    Class: classNames[classByStudent[r.student_id]] ?? "",
    Status: r.status,
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="attendance-export.csv"',
    },
  });
}
