import { redirect } from "next/navigation";
import { StayBackApprovalList } from "@/components/stay-back-approval-list";
import { ExportCsvButton } from "@/components/export-csv-button";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ensureStayBackChains } from "@/lib/stay-back-chain";
import { DATE_RANGE_OPTIONS, rangeFrom } from "@/lib/date-range";
import type { Tables } from "@/lib/supabase/database.types";

export default async function StayBackApprovals({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const { range } = await searchParams;
  const from = rangeFrom(range);

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

  const [{ data: consents }, { data: students }, { data: teachers }, { data: guardians }, { data: classSections }] =
    await Promise.all([
      consentsQuery,
      supabase.from("students").select("*"),
      supabase.from("staff").select("*"),
      supabase.from("guardians").select("id, name, phone"),
      supabase.from("class_sections").select("id, grade"),
    ]);

  const guardianPhones = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.phone]));
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));
  const staffNames = Object.fromEntries((teachers ?? []).map((t) => [t.id, t.name]));

  // Grade per student, so a self-healed chain can decide whether to include the
  // coordinator step (skipped for grade 8+).
  const gradeByClass = Object.fromEntries((classSections ?? []).map((c) => [c.id, c.grade]));
  const gradeByStudent = Object.fromEntries(
    (students ?? []).map((s) => [s.id, gradeByClass[s.class_section_id]]),
  );

  // Heal any pending consents that have no approval chain (created before the
  // chain existed, or where chain creation failed after the consent insert) —
  // otherwise they'd show a bare "pending" with no per-approver breakdown.
  await ensureStayBackChains(supabase, consents ?? [], gradeByStudent);

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

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Time range</span>
          <select
            name="range"
            defaultValue={range ?? "all"}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
          >
            {DATE_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-sm bg-maroon px-4 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong"
        >
          Apply
        </button>
        {range && (
          <a
            href="/console/stay-back"
            className="rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
          >
            Clear filter
          </a>
        )}
      </form>

      <StayBackApprovalList
        consents={consents ?? []}
        students={students ?? []}
        teachers={teachers ?? []}
        guardianPhones={guardianPhones}
        guardianNames={guardianNames}
        staffNames={staffNames}
        viewer={viewer.staff}
        stepsByConsent={stepsByConsent}
      />
    </div>
  );
}
