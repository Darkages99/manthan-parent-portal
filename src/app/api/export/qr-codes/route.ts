import JSZip from "jszip";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { renderQrSvg } from "@/lib/qr";

// GET /api/export/qr-codes — a ZIP of every issued student QR code as an SVG.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") return new Response("Unauthorized", { status: 401 });
  if (viewer.staff.role !== "principal" && viewer.staff.role !== "super_admin") {
    return new Response("Only the principal can export QR codes", { status: 403 });
  }

  const supabase = await createClient();
  const { data: codes, error } = await supabase.from("student_qr_codes").select("student_id, token");
  if (error) return new Response(error.message, { status: 500 });
  if (!codes || codes.length === 0) {
    return new Response("No QR codes have been issued yet", { status: 404 });
  }

  const studentIds = codes.map((c) => c.student_id);
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_no")
    .in("id", studentIds);
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  const zip = new JSZip();
  await Promise.all(
    codes.map(async (c) => {
      const student = studentById.get(c.student_id);
      const svg = await renderQrSvg(c.token);
      const name = student ? `${student.roll_no}-${student.first_name}-${student.last_name}` : c.student_id;
      zip.file(`${name}.svg`, svg);
    })
  );

  const buffer = await zip.generateAsync({ type: "uint8array" });

  // Node's Buffer/Uint8Array types report an ArrayBufferLike backing store,
  // which TS's DOM lib no longer accepts as BodyInit directly — this is a
  // valid Response body at runtime regardless.
  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="qr-codes.zip"',
    },
  });
}
