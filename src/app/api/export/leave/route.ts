import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

// GET /api/export/leave?from=YYYY-MM-DD&to=YYYY-MM-DD
// Exports the caller's visible leave requests as CSV. `from`/`to` filter on any overlap between
// the request's [from_date, to_date] span and the given range.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();

  let query = supabase.from("leave_requests").select("*").order("from_date", { ascending: false });

  if (viewer.type === "guardian") {
    const studentIds = viewer.students.map((s) => s.id);
    query = query.in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  } else if (viewer.staff.role === "class_teacher") {
    // Mirror src/app/(staff)/console/leave/page.tsx: a class teacher only sees requests for
    // their own class's students; other staff roles see all.
    const { data: ownClasses } = await supabase
      .from("class_sections")
      .select("id")
      .eq("class_teacher_id", viewer.staff.id);
    const ownClassIds = (ownClasses ?? []).map((c) => c.id);
    const { data: ownStudents } = ownClassIds.length
      ? await supabase.from("students").select("id").in("class_section_id", ownClassIds)
      : { data: [] as { id: string }[] };
    const ownStudentIds = (ownStudents ?? []).map((s) => s.id);
    query = query.in("student_id", ownStudentIds.length ? ownStudentIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  // Overlap: the request's span intersects the requested [from, to] range.
  if (from) query = query.gte("to_date", from);
  if (to) query = query.lte("from_date", to);

  const { data: leaves, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const studentIds = [...new Set((leaves ?? []).map((l) => l.student_id))];
  const { data: students } = studentIds.length
    ? await supabase.from("students").select("id, first_name, last_name").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };

  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );

  const rows = (leaves ?? []).map((l) => ({
    "Student name": studentNames[l.student_id] ?? l.student_id,
    "From date": l.from_date,
    "To date": l.to_date,
    Reason: l.reason,
    Status: l.status,
    "Decided at": l.decided_at ?? "",
    "Created at": l.created_at,
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="leave-export.csv"',
    },
  });
}
