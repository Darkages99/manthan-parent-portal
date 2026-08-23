import { redirect } from "next/navigation";
import { StayBackApprovalList } from "@/components/stay-back-approval-list";
import { ExportCsvButton } from "@/components/export-csv-button";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function StayBackApprovals() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();

  // A class teacher only decides requests named to them; the principal sees every request.
  let consentsQuery = supabase
    .from("stay_back_consents")
    .select("*")
    .order("created_at", { ascending: false });
  if (viewer.staff.role === "class_teacher") {
    consentsQuery = consentsQuery.eq("teacher_id", viewer.staff.id);
  }

  const [{ data: consents }, { data: students }, { data: teachers }, { data: guardians }] =
    await Promise.all([
      consentsQuery,
      supabase.from("students").select("*"),
      supabase.from("staff").select("*"),
      supabase.from("guardians").select("id, phone"),
    ]);

  const guardianPhones = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.phone]));

  const consentIds = (consents ?? []).map((c) => c.id);
  const { data: steps } =
    consentIds.length > 0
      ? await supabase
          .from("approval_steps")
          .select("*")
          .eq("subject_type", "stay_back_consent")
          .in("subject_id", consentIds)
          .order("step_order", { ascending: true })
      : { data: [] };

  const stepsByConsent: Record<string, Tables<"approval_steps">[]> = {};
  for (const s of steps ?? []) {
    (stepsByConsent[s.subject_id] ??= []).push(s);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approvals</p>
          <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Stay-back consent</h1>
          <p className="mt-2 max-w-prose text-lg text-slate-strong">
            Raised by a parent. The named teacher, front office, coordinator and principal each
            approve their step — any one declining closes the request.
          </p>
        </div>
        <ExportCsvButton href="/api/export/stay-back" />
      </div>

      <StayBackApprovalList
        consents={consents ?? []}
        students={students ?? []}
        teachers={teachers ?? []}
        guardianPhones={guardianPhones}
        viewer={viewer.staff}
        stepsByConsent={stepsByConsent}
      />
    </div>
  );
}
