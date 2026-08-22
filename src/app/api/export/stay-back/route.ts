import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
import { toCsv } from "@/lib/csv";

// GET /api/export/stay-back?from=YYYY-MM-DD&to=YYYY-MM-DD
// Exports the caller's visible stay-back consent requests as CSV, filtered on `stay_date`.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();

  let query = supabase.from("stay_back_consents").select("*").order("stay_date", { ascending: false });

  if (viewer.type === "guardian") {
    const studentIds = viewer.students.map((s) => s.id);
    query = query.in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  } else {
    // Mirror src/app/(staff)/console/stay-back/page.tsx: a class teacher only sees requests
    // named to them; other staff roles (front office, coordinator, principal) see all.
    if (viewer.staff.role === "class_teacher") {
      query = query.eq("teacher_id", viewer.staff.id);
    }
  }

  if (from) query = query.gte("stay_date", from);
  if (to) query = query.lte("stay_date", to);

  const { data: consents, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const studentIds = [...new Set((consents ?? []).map((c) => c.student_id))];
  const teacherIds = [...new Set((consents ?? []).map((c) => c.teacher_id))];

  const [{ data: students }, { data: teachers }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id, first_name, last_name").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    teacherIds.length
      ? supabase.from("staff").select("id, name").in("id", teacherIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const teacherNames = Object.fromEntries((teachers ?? []).map((t) => [t.id, t.name]));

  const rows = (consents ?? []).map((c) => ({
    "Student name": studentNames[c.student_id] ?? c.student_id,
    "Teacher name": teacherNames[c.teacher_id] ?? c.teacher_id,
    Purpose: c.purpose,
    "Purpose detail": c.purpose_detail ?? "",
    "Mode of transport": c.mode_of_transport ?? "",
    "Stay date": c.stay_date,
    "From time": formatTime(c.from_time),
    "To time": formatTime(c.to_time),
    Reason: c.reason,
    Status: c.status,
    "Created at": c.created_at,
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="stay-back-export.csv"',
    },
  });
}
