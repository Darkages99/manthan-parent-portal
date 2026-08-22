import { redirect } from "next/navigation";
import { ReportIssueForm } from "@/components/report-issue-form";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  resolved: "Resolved",
};

export default async function ReportIssuePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const { data: issues } = await supabase
    .from("reported_issues")
    .select("*")
    .eq("reported_by_guardian_id", viewer.guardian.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Feedback</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Report an issue</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Let the school know about a concern. Mark it confidential to keep it visible to the
          principal only — otherwise any staff member can see it for triage.
        </p>
      </div>

      <ReportIssueForm />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Your reports</h2>
        <ul className="flex flex-col gap-3">
          {(issues ?? []).map((i) => (
            <li
              key={i.id}
              className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-maroon">{i.subject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-slate-strong">{i.body}</p>
                  <p className="mt-2 text-sm text-slate">
                    {formatDate(i.created_at)}
                    {i.confidential && " · Confidential"}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${statusStyles[i.status]}`}
                >
                  {statusLabels[i.status]}
                </span>
              </div>
            </li>
          ))}
          {(!issues || issues.length === 0) && (
            <p className="text-base text-slate">No reports yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
