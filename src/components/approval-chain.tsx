"use client";

import type { Enums, Tables } from "@/lib/supabase/database.types";
import { roleLabel } from "@/lib/role-labels";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "./icons";

type ApprovalStep = Tables<"approval_steps">;

/**
 * Visualizes a subject's approval chain as connected circular nodes — a red
 * hollow ring while waiting, filled green once approved, filled crimson (with
 * everything after it dimmed) if declined. Steps are decided independently —
 * a later role can approve before an earlier one — so this shows each step's
 * real, current state rather than implying a forced left-to-right sequence.
 */
export function ApprovalChain({
  steps,
  staffNames,
  highlightStepId,
}: {
  steps: ApprovalStep[];
  /** staff id → display name, for the named teacher / whoever decided a step. */
  staffNames?: Record<string, string>;
  /** The viewer's own open step, if any — gets a pulsing ring and "Your turn". */
  highlightStepId?: string | null;
}) {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  if (ordered.length === 0) {
    return <p className="text-sm text-slate">Approval chain not set up yet.</p>;
  }
  const declinedAt = ordered.findIndex((s) => s.decision === "declined");

  return (
    <div className="overflow-x-auto">
      <div className="flex w-max items-start">
        {ordered.map((step, i) => {
          const state: "approved" | "declined" | "waiting" = step.decision ?? "waiting";
          const blocked = declinedAt !== -1 && i > declinedAt;
          const name = step.approver_staff_id ? staffNames?.[step.approver_staff_id] : undefined;
          const prevApproved = i > 0 && ordered[i - 1].decision === "approved";
          const isYourTurn = state === "waiting" && !blocked && step.id === highlightStepId;

          const title = blocked
            ? "Chain stopped — an earlier step declined"
            : state === "waiting"
              ? name
                ? `Waiting on ${name}`
                : "Waiting"
              : `${state === "approved" ? "Approved" : "Declined"}${name ? ` by ${name}` : ""}`;

          return (
            <div key={step.id} className="flex items-start">
              {i > 0 && (
                <div
                  className={`mt-[27px] h-0.5 w-7 shrink-0 transition-colors duration-500 sm:w-10 ${
                    blocked
                      ? "bg-slate-200 dark:bg-slate-700"
                      : prevApproved
                        ? "bg-emerald-400"
                        : "bg-rose-300 dark:bg-rose-900/60"
                  }`}
                />
              )}
              <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20" title={title}>
                <div className="relative mt-2 flex h-10 w-10 items-center justify-center">
                  {isYourTurn && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50" />
                  )}
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm transition-colors duration-500 ${
                      blocked
                        ? "border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600"
                        : state === "approved"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : state === "declined"
                            ? "border-rose-600 bg-rose-600 text-white"
                            : isYourTurn
                              ? "border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                              : "border-rose-300 bg-rose-50/70 text-rose-400 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-400/80"
                    }`}
                  >
                    {state === "approved" ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : state === "declined" ? (
                      <XCircleIcon className="h-5 w-5" />
                    ) : (
                      <ClockIcon className="h-5 w-5" />
                    )}
                  </div>
                </div>
                <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight text-slate-strong">
                  {name ?? roleLabel(step.approver_role as Enums<"role">)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
