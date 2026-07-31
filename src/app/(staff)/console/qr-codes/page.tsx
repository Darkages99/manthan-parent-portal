import { redirect } from "next/navigation";
import { QrManager } from "@/components/qr-manager";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function StaffQrCodes() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const canManage =
    viewer.staff.role === "principal" || viewer.staff.role === "super_admin";

  const supabase = await createClient();
  const [{ data: classes }, { data: students }, { data: issued }] = await Promise.all([
    supabase.from("class_sections").select("*").order("grade"),
    supabase.from("students").select("*").order("roll_no"),
    supabase.from("student_qr_codes").select("student_id"),
  ]);

  const studentsByClass: Record<string, Tables<"students">[]> = {};
  for (const c of classes ?? []) studentsByClass[c.id] = [];
  for (const s of students ?? []) studentsByClass[s.class_section_id]?.push(s);

  const issuedStudentIds = (issued ?? []).map((r) => r.student_id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Identity</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Student QR codes</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Each child carries one stable QR code, used to identify them by scan for attendance and
          more. {canManage
            ? "Generate a code once and it's stored — retrieving it later never changes it. Regenerate only if a card is lost."
            : "Pick a student to pull up their code for scanning. Only the principal can generate or change codes."}
        </p>
      </div>

      <QrManager
        classes={classes ?? []}
        studentsByClass={studentsByClass}
        issuedStudentIds={issuedStudentIds}
        canManage={canManage}
      />
    </div>
  );
}
