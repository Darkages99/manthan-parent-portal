import { redirect } from "next/navigation";
import { ApprovalChain } from "@/components/approval-chain";
import { StayBackFormTrigger } from "@/components/stay-back-form-trigger";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
import { DATE_RANGE_OPTIONS, rangeFrom } from "@/lib/date-range";
import type { Tables } from "@/lib/supabase/database.types";

export default async function StayBackPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const { range } = await searchParams;
  const from = rangeFrom(range);

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);

  let consentsQuery = supabase
    .from("stay_back_consents")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  if (from) consentsQuery = consentsQuery.gte("stay_date", from);

  const [{ data: consents }, { data: teachers }, { data: lastConsent }] = await Promise.all([
    consentsQuery,
    supabase.from("staff_directory").select("id, name, role").in("role", ["class_teacher", "principal"]),
    supabase
      .from("stay_back_consents")
      .select("mode_of_transport")
      .eq("raised_by_guardian_id", viewer.guardian.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const exportQuery = range ? new URLSearchParams({ range }).toString() : "";

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

  const stepsByConsent = new Map<string, Tables<"approval_steps">[]>();
  for (const s of steps ?? []) {
    const arr = stepsByConsent.get(s.subject_id) ?? [];
    arr.push(s);
    stepsByConsent.set(s.subject_id, arr);
  }

  const studentById = (id: string) => viewer.students.find((s) => s.id === id);
  const teacherById = (id: string) => (teachers ?? []).find((t) => t.id === id);
  const staffNames = Object.fromEntries((teachers ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approval workflow</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Stay-back consent</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Raising a request starts an approval chain — the named teacher, then front office
          (and coordinator, for classes below Grade 8), then principal. The named teacher and
          principal get a push notification right away.
        </p>
      </div>

      <StayBackFormTrigger
        students={viewer.students}
        teachers={teachers ?? []}
        defaultTransport={lastConsent?.mode_of_transport}
      />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Your requests</h2>

        <form
          method="GET"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
        >
          <label className="flex flex-col gap-1.5 text-base">
            <span className="font-medium text-maroon">Filter</span>
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
              href="/stay-back"
              className="rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
            >
              Clear filter
            </a>
          )}
          <a
            href={`/api/export/stay-back${exportQuery ? `?${exportQuery}` : ""}`}
            className="ml-auto rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
          >
            Download CSV
          </a>
        </form>

        <ul className="flex flex-col gap-3">
          {(consents ?? []).map((c) => {
            const student = studentById(c.student_id);
            const teacher = teacherById(c.teacher_id);
            return (
              <li className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--shadow-card)]" key={c.id}>
                <div className="px-5 pt-5">
                  <p className="text-base font-semibold text-maroon">
                    {student?.first_name} — {c.reason}
                  </p>
                  <p className="mt-1 text-base text-slate-strong">
                    {c.stay_date} · {formatTime(c.from_time)}–{formatTime(c.to_time)} · Notified{" "}
                    {teacher?.name}
                    {teacher?.role === "class_teacher" ? " + Principal" : ""}
                  </p>
                </div>
                <div className="mt-4 border-t border-hairline bg-mist/40 px-5 py-4">
                  <ApprovalChain steps={stepsByConsent.get(c.id) ?? []} staffNames={staffNames} />
                </div>
              </li>
            );
          })}
          {(!consents || consents.length === 0) && (
            <p className="text-base text-slate">No requests yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
