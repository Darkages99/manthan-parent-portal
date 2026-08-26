import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

// GET /api/export/notification-log?from=YYYY-MM-DD&to=YYYY-MM-DD
// Proof-of-notification export for the school — who was notified of what,
// when, and whether the push actually reached a device.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff" || !isPrincipalRole(viewer.staff.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();
  let query = supabase.from("notification_log").select("*").order("sent_at", { ascending: false });
  if (from) query = query.gte("sent_at", from);
  if (to) query = query.lte("sent_at", to);

  const { data: log, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const guardianIds = [...new Set((log ?? []).filter((l) => l.recipient_type === "guardian").map((l) => l.recipient_id))];
  const staffIds = [...new Set((log ?? []).filter((l) => l.recipient_type === "staff").map((l) => l.recipient_id))];
  const [{ data: guardians }, { data: staff }] = await Promise.all([
    guardianIds.length
      ? supabase.from("guardians").select("id, name").in("id", guardianIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    staffIds.length
      ? supabase.from("staff").select("id, name").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));
  const staffNames = Object.fromEntries((staff ?? []).map((s) => [s.id, s.name]));

  const rows = (log ?? []).map((l) => ({
    "Sent at": l.sent_at,
    Recipient:
      (l.recipient_type === "guardian" ? guardianNames[l.recipient_id] : staffNames[l.recipient_id]) ??
      l.recipient_id,
    "Recipient type": l.recipient_type,
    Category: l.category,
    Title: l.title,
    Body: l.body,
    Delivered: l.delivered ? "Yes" : "No",
  }));

  const csv = toCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="notification-log-export.csv"',
    },
  });
}
