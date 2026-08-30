import { NextResponse } from "next/server";
import { assertCanManageReportCard } from "@/lib/results-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFileAdmin } from "@/lib/firebase/admin-storage";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const studentId = form.get("studentId");
  const term = form.get("term");
  const file = form.get("file");
  if (typeof studentId !== "string" || !studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  try {
    await assertCanManageReportCard(studentId);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }
  if (typeof term !== "string" || !term) {
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF report cards are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (10MB max)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `report-cards/${studentId}/${term}/${file.name}`;

  try {
    const storageUrl = await uploadFileAdmin(storagePath, bytes, file.type);

    const admin = createAdminClient();
    const { error, count } = await admin
      .from("exam_results")
      .update({ report_card_pdf_url: storageUrl }, { count: "exact" })
      .eq("student_id", studentId)
      .eq("term", term);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("No marks entered for that term yet — add marks before publishing a report card");

    return NextResponse.json({ url: storageUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
