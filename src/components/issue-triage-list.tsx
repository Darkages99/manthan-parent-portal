"use client";

import { useTransition } from "react";
import { resolveIssue } from "@/app/(staff)/console/issues/actions";
import { formatDate } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

type Issue = Tables<"reported_issues">;

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

export function IssueTriageList({
  issues,
  reporterNames,
  recipientNames = {},
  emptyLabel = "No issues reported yet.",
}: {
  issues: Issue[];
  reporterNames: Record<string, string>;
  recipientNames?: Record<string, string[]>;
  emptyLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <ul className="flex flex-col gap-4">
      {issues.map((i) => (
        <li
          key={i.id}
          className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-maroon">{i.subject}</p>
              <p className="mt-1 whitespace-pre-wrap text-base text-slate-strong">{i.body}</p>
              <p className="mt-2 text-sm text-slate">
                {formatDate(i.created_at)} · Reported by {reporterNames[i.id] ?? "someone"}
                {(recipientNames[i.id]?.length ?? 0) > 0
                  ? ` · Directed to ${recipientNames[i.id].join(", ")}`
                  : ` · ${audienceLabels[i.audience] ?? ""}`}
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${statusStyles[i.status]}`}
            >
              {statusLabels[i.status]}
            </span>
          </div>

          {i.status === "open" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={isPending}
                onClick={() => startTransition(() => resolveIssue(i.id))}
                className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
              >
                Mark resolved
              </button>
            </div>
          )}
        </li>
      ))}
      {issues.length === 0 && <p className="text-base text-slate">{emptyLabel}</p>}
    </ul>
  );
}
