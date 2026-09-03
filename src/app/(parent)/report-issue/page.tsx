import { redirect } from "next/navigation";
import { ReportIssueFormTrigger } from "@/components/report-issue-form-trigger";
import type { TypeaheadOption } from "@/components/typeahead-picker";
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

const audienceLabels: Record<string, string> = {
  principal_only: "Principal only",
  front_office_and_principal: "Front office + principal",
};

export default async function ReportIssuePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const [{ data: issues }, { data: teacherRows }] = await Promise.all([
    supabase
      .from("reported_issues")
      .select("*")
      .eq("reported_by_guardian_id", viewer.guardian.id)
      .order("created_at", { ascending: false }),
    supabase.from("staff_directory").select("id, name").eq("role", "class_teacher").order("name"),
  ]);

  const teachers: TypeaheadOption[] = (teacherRows ?? []).map((t) => ({ id: t.id, label: t.name }));

  // Recipient teacher names for the user's own directed reports.
  const issueIds = (issues ?? []).map((i) => i.id);
  const { data: recipients } = issueIds.length
    ? await supabase
        .from("reported_issue_recipients")
        .select("issue_id, staff:staff_id (name)")
        .in("issue_id", issueIds)
    : { data: [] };

  const recipientsByIssue = new Map<string, string[]>();
  for (const r of recipients ?? []) {
    const name = (r.staff as { name: string } | null)?.name;
    if (!name) continue;
    const list = recipientsByIssue.get(r.issue_id) ?? [];
    list.push(name);
    recipientsByIssue.set(r.issue_id, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Feedback</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Report an issue</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Let the school know about a concern. Choose who can see it — the front office and
          principal, the principal alone, or a specific teacher (also visible to the front office
          and principal).
        </p>
      </div>

      <ReportIssueFormTrigger teachers={teachers} />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Your reports</h2>
        <ul className="flex flex-col gap-3">
          {(issues ?? []).map((i) => {
            const directed = recipientsByIssue.get(i.id) ?? [];
            return (
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
                      {directed.length > 0
                        ? ` · Directed to ${directed.join(", ")}`
                        : ` · ${audienceLabels[i.audience] ?? ""}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${statusStyles[i.status]}`}
                  >
                    {statusLabels[i.status]}
                  </span>
                </div>
              </li>
            );
          })}
          {(!issues || issues.length === 0) && (
            <p className="text-base text-slate">No reports yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
