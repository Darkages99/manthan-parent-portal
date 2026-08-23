"use client";

import type { Enums, Tables } from "@/lib/supabase/database.types";
import { roleLabel } from "@/lib/role-labels";

type ApprovalStep = Tables<"approval_steps">;

const styles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const labels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
};

/** Small checklist showing each step of a booking's approval chain, in order. */
export function ApprovalChecklist({ steps }: { steps: ApprovalStep[] }) {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  return (
    <ul className="flex flex-col gap-1">
      {ordered.map((step) => {
        const status = step.decision ?? "pending";
        return (
          <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-strong">{roleLabel(step.approver_role as Enums<"role">)}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}
            >
              {labels[status]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
