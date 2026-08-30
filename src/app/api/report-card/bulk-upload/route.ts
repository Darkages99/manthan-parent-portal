import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFileAdmin } from "@/lib/firebase/admin-storage";

const MAX_BYTES = 10 * 1024 * 1024;

/** Case/whitespace/separator-insensitive comparison key for full names. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mass-publishes report card PDFs for a whole class + term: one multipart
 * request, each file matched to a student by filename — the roll number
 * first (e.g. "101.pdf"), then the full name (e.g. "John_Doe.pdf") if no
 * roll number matches. Mirrors the { imported, errors } shape used by the
 * CSV bulk-import actions, keyed by filename instead of row number.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") {
    return NextResponse.json({ error: "Not signed in as staff" }, { status: 401 });
  }
  const canManageAnyClass = isPrincipalRole(viewer.staff.role) || viewer.staff.role === "front_office";

  const form = await request.formData();
  const classId = form.get("classId");
  const term = form.get("term");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (typeof classId !== "string" || !classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }
  if (typeof term !== "string" || !term) {
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!canManageAnyClass) {
    if (viewer.staff.role !== "class_teacher") {
      return NextResponse.json({ error: "Not authorized to manage report cards" }, { status: 401 });
    }
    const taughtClassIds = await getTaughtClassIds(supabase, viewer.staff.id);
    if (!taughtClassIds.includes(classId)) {
      return NextResponse.json({ error: "Not your class" }, { status: 401 });
    }
  }

  const { data: roster } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_no")
    .eq("class_section_id", classId);
  const students = roster ?? [];

  const admin = createAdminClient();
  const errors: { file: string; message: string }[] = [];
  let imported = 0;

  for (const file of files) {
    const key = file.name.replace(/\.[^.]+$/, "").trim();

    if (file.type !== "application/pdf") {
      errors.push({ file: file.name, message: "Only PDF report cards are supported" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push({ file: file.name, message: "File is too large (10MB max)" });
      continue;
    }
    if (!key) {
      errors.push({ file: file.name, message: "Filename has no name to match against" });
      continue;
    }

    const rollMatches = students.filter((s) => s.roll_no.trim().toLowerCase() === key.toLowerCase());
    const matches = rollMatches.length
      ? rollMatches
      : students.filter((s) => normalizeName(`${s.first_name} ${s.last_name}`) === normalizeName(key));

    if (matches.length === 0) {
      errors.push({ file: file.name, message: `No student in this class matches '${key}' by roll number or name` });
      continue;
    }
    if (matches.length > 1) {
      errors.push({
        file: file.name,
        message: `Multiple students match '${key}' — rename the file to use the roll number instead`,
      });
      continue;
    }

    const student = matches[0];
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const storagePath = `report-cards/${student.id}/${term}/${file.name}`;
      const storageUrl = await uploadFileAdmin(storagePath, bytes, file.type);

      const { error, count } = await admin
        .from("exam_results")
        .update({ report_card_pdf_url: storageUrl }, { count: "exact" })
        .eq("student_id", student.id)
        .eq("term", term);
      if (error) throw new Error(error.message);
      if (!count) {
        throw new Error(
          `No marks entered for ${student.first_name} ${student.last_name} in ${term} yet — add marks before publishing`
        );
      }
      imported += 1;
    } catch (err) {
      errors.push({ file: file.name, message: (err as Error).message });
    }
  }

  return NextResponse.json({ imported, errors });
}
