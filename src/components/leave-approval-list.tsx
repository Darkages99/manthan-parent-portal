"use client";

import { useTransition } from "react";
import { StatusPill } from "@/components/status-pill";
import { decideLeave } from "@/app/(staff)/console/leave/actions";
import { formatDate } from "@/lib/format";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Leave = Tables<"leave_requests">;

export function LeaveApprovalList({
  leaves,
  studentNames,
  guardianNames,
  emptyLabel = "No leave requests yet.",
}: {
  leaves: Leave[];
  studentNames: Record<string, string>;
  guardianNames: Record<string, string>;
  emptyLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function decide(id: string, decision: "approved" | "declined") {
    startTransition(async () => {
      try {
        await decideLeave(id, decision);
        toast.success(decision === "approved" ? "Leave approved" : "Leave declined");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save decision");
      }
    });
  }

  return (
    <ul className="flex flex-col gap-4">
      {leaves.map((l) => (
        <li key={l.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-maroon">
                {studentNames[l.student_id] ?? "Student"} — {l.reason}
              </p>
              <p className="mt-1 text-base text-slate-strong">
                {formatDate(l.from_date)} → {formatDate(l.to_date)} · Requested by{" "}
                {guardianNames[l.requested_by] ?? "guardian"}
              </p>
            </div>
            <StatusPill status={l.status} />
          </div>

          {l.status === "pending" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={isPending}
                onClick={() => decide(l.id, "approved")}
                className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
              >
                Approve
              </button>
              <button
                disabled={isPending}
                onClick={() => decide(l.id, "declined")}
                className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          )}
        </li>
      ))}
      {leaves.length === 0 && <p className="text-base text-slate">{emptyLabel}</p>}
    </ul>
  );
}
