import { redirect } from "next/navigation";
import { StayBackApprovalList } from "@/components/stay-back-approval-list";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export default async function StayBackApprovals({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const { from, to } = await searchParams;

  const supabase = await createClient();

  // A class teacher only decides requests named to them; the principal sees every request.
  let consentsQuery = supabase
    .from("stay_back_consents")
    .select("*")
    .order("created_at", { ascending: false });
  if (viewer.staff.role === "class_teacher") {
    consentsQuery = consentsQuery.eq("teacher_id", viewer.staff.id);
  }
  if (from) consentsQuery = consentsQuery.gte("stay_date", from);
  if (to) consentsQuery = consentsQuery.lte("stay_date", to);

  const exportQuery = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();

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
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approvals</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Stay-back consent</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Raised by a parent. The named teacher, front office, coordinator and principal each
          approve their step — any one declining closes the request.
        </p>
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">From</span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">To</span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
          />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-maroon px-4 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong"
        >
          Filter
        </button>
        <a
          href={`/api/export/stay-back${exportQuery ? `?${exportQuery}` : ""}`}
          className="rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
        >
          Download CSV
        </a>
      </form>

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
