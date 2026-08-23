"use client";

import type { Enums, Tables } from "@/lib/supabase/database.types";
import { roleLabel } from "@/lib/role-labels";

type ApprovalStep = Tables<"approval_steps">;

const styles: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const labels: Record<string, string> = {
  waiting: "Waiting",
  approved: "Approved",
  declined: "Declined",
};

/**
 * Each step of a subject's approval chain, in order — the role, who owns or
 * acted on it, and whether it's approved, declined, or still waiting. Steps are
 * independent: a later role can approve before an earlier one, so this shows the
 * true bottleneck rather than implying a strict sequence.
 */
export function ApprovalChecklist({
  steps,
  staffNames,
}: {
  steps: ApprovalStep[];
  /** staff id → display name, for the named teacher / whoever decided a step. */
  staffNames?: Record<string, string>;
}) {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  if (ordered.length === 0) {
    return <p className="text-sm text-slate">Approval chain not set up yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {ordered.map((step) => {
        const state = step.decision ?? "waiting";
        const name = step.approver_staff_id ? staffNames?.[step.approver_staff_id] : undefined;
        // The pill carries the status word; this sub-line just names the person —
        // whoever acted on a decided step, or the pre-assigned owner of an open
        // one (the named class teacher). Blank when nobody specific is on it.
        const detail =
          state === "waiting"
            ? name
              ? `Waiting on ${name}`
              : null
            : name
              ? `by ${name}`
              : null;
        return (
          <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="font-medium text-slate-strong">
                {roleLabel(step.approver_role as Enums<"role">)}
              </span>
              {detail && <span className="truncate text-xs text-slate">{detail}</span>}
            </span>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[state]}`}
            >
              {labels[state]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
