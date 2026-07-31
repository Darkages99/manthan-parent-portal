"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { renderQrSvg } from "@/lib/qr";
import type { Enums } from "@/lib/supabase/database.types";

/** A student's stored QR code plus its rendered SVG, ready to show or print. */
export type StudentQr = {
  studentId: string;
  token: string;
  issuedAt: string;
  /** Standalone SVG markup encoding `token`. */
  svg: string;
};

function canManage(role: Enums<"role">) {
  return role === "principal" || role === "super_admin";
}

async function requireStaff() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  return viewer;
}

async function requirePrincipal() {
  const viewer = await requireStaff();
  if (!canManage(viewer.staff.role)) {
    throw new Error("Only the principal can generate or change QR codes");
  }
  return viewer;
}

/** Read-only lookup for any staff member. Returns null if none has been issued. */
export async function getStudentQr(studentId: string): Promise<StudentQr | null> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_qr_codes")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    studentId,
    token: data.token,
    issuedAt: data.issued_at,
    svg: await renderQrSvg(data.token),
  };
}

/**
 * Issues a QR code for a student. Idempotent by design: if one already exists it
 * is returned unchanged — retrieving a code never rotates it. Use
 * `regenerateStudentQr` to deliberately replace one.
 */
export async function issueStudentQr(studentId: string): Promise<StudentQr> {
  const viewer = await requirePrincipal();
  const supabase = await createClient();

  const existing = await supabase
    .from("student_qr_codes")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  let row = existing.data;
  if (!row) {
    const inserted = await supabase
      .from("student_qr_codes")
      .insert({ student_id: studentId, issued_by: viewer.staff.id })
      .select("*")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    row = inserted.data;
  }

  revalidatePath("/console/qr-codes");
  return {
    studentId,
    token: row.token,
    issuedAt: row.issued_at,
    svg: await renderQrSvg(row.token),
  };
}

/** Rotates a student's token — the old QR/card stops resolving. Principal only. */
export async function regenerateStudentQr(studentId: string): Promise<StudentQr> {
  const viewer = await requirePrincipal();
  const supabase = await createClient();

  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("student_qr_codes")
    .upsert(
      {
        student_id: studentId,
        token,
        issued_by: viewer.staff.id,
        issued_at: new Date().toISOString(),
      },
      { onConflict: "student_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/console/qr-codes");
  return {
    studentId,
    token: data.token,
    issuedAt: data.issued_at,
    svg: await renderQrSvg(data.token),
  };
}

/**
 * Bulk-issues codes for every student who does not yet have one, so the whole
 * roll is covered in one action. Existing codes are left untouched. Principal only.
 */
export async function issueMissingQrCodes(): Promise<{ created: number }> {
  const viewer = await requirePrincipal();
  const supabase = await createClient();

  const [students, existing] = await Promise.all([
    supabase.from("students").select("id"),
    supabase.from("student_qr_codes").select("student_id"),
  ]);
  if (students.error) throw new Error(students.error.message);
  if (existing.error) throw new Error(existing.error.message);

  const have = new Set((existing.data ?? []).map((r) => r.student_id));
  const missing = (students.data ?? []).filter((s) => !have.has(s.id));
  if (missing.length === 0) return { created: 0 };

  const { error } = await supabase
    .from("student_qr_codes")
    .insert(missing.map((s) => ({ student_id: s.id, issued_by: viewer.staff.id })));
  if (error) throw new Error(error.message);

  revalidatePath("/console/qr-codes");
  return { created: missing.length };
}
