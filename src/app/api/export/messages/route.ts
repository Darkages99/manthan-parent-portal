import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatSlotTime } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import { rangeFrom } from "@/lib/date-range";

// GET /api/export/messages?range=week|month|6months|year|all&urgent=1|0
// Exports the caller's visible sent-message history as CSV, filtered on `sent_at`.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const from = rangeFrom(searchParams.get("range"));
  const urgent = searchParams.get("urgent");

  const supabase = await createClient();

  let query = supabase
    .from("messages")
    .select("*, staff(name), message_targets(*)")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });

  if (from) query = query.gte("sent_at", from);
  if (urgent === "1") query = query.eq("urgent", true);
  if (urgent === "0") query = query.eq("urgent", false);

  const { data: messages, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const classSectionIds = new Set<string>();
  const studentIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const m of messages ?? []) {
    for (const t of m.message_targets ?? []) {
      if (t.class_section_id) classSectionIds.add(t.class_section_id);
      if (t.student_id) studentIds.add(t.student_id);
      if (t.custom_group_id) groupIds.add(t.custom_group_id);
    }
  }

  const [{ data: classSections }, { data: students }, { data: groups }] = await Promise.all([
    classSectionIds.size
      ? supabase.from("class_sections").select("id, grade, section").in("id", [...classSectionIds])
      : Promise.resolve({ data: [] as { id: string; grade: string; section: string }[] }),
    studentIds.size
      ? supabase.from("students").select("id, first_name, last_name").in("id", [...studentIds])
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    groupIds.size
      ? supabase.from("custom_groups").select("id, name").in("id", [...groupIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const classNames = Object.fromEntries((classSections ?? []).map((c) => [c.id, `Grade ${c.grade}-${c.section}`]));
  const studentNames = Object.fromEntries((students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));
  const groupNames = Object.fromEntries((groups ?? []).map((g) => [g.id, g.name]));

  function recipientSummary(m: NonNullable<typeof messages>[number]): string {
    if (m.scope_type === "school") return "Whole school";
    const names = (m.message_targets ?? [])
      .map((t) => {
        if (t.class_section_id) return classNames[t.class_section_id];
        if (t.student_id) return studentNames[t.student_id];
        if (t.custom_group_id) return groupNames[t.custom_group_id];
        return null;
      })
      .filter((n): n is string => !!n);
    return names.length ? names.join("; ") : "";
  }

  const rows = (messages ?? []).map((m) => ({
    Subject: m.subject,
    Body: m.body,
    Urgent: m.urgent ? "Yes" : "No",
    "Sent by": m.staff?.name ?? "",
    "Sent at": m.sent_at ? formatSlotTime(m.sent_at) : "",
    Recipients: recipientSummary(m),
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="sent-messages-export.csv"',
    },
  });
}
