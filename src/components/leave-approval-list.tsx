"use client";

import { useState, useTransition } from "react";
import { StatusPill } from "@/components/status-pill";
import { decideLeave, sendLeaveMessage } from "@/app/(staff)/console/leave/actions";
import { formatDate } from "@/lib/format";
import { useToast } from "./toast-provider";
import { Button } from "./button";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type Leave = Tables<"leave_requests">;

const PRINCIPAL_APPROVAL_DAY_SPAN = 3;

function daySpan(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export function LeaveApprovalList({
  leaves,
  studentNames,
  guardianNames,
  emptyLabel = "No leave requests yet.",
  initialCount,
  viewerRole,
}: {
  leaves: Leave[];
  studentNames: Record<string, string>;
  guardianNames: Record<string, string>;
  emptyLabel?: string;
  /** When set, only the first N requests show until "See more" is clicked. */
  initialCount?: number;
  /** Gates the Approve button: a class teacher can't approve a leave over 3 days. */
  viewerRole: Enums<"role">;
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const toast = useToast();

  const capped = initialCount !== undefined && !expanded;
  const shown = capped ? leaves.slice(0, initialCount) : leaves;
  const hiddenCount = initialCount !== undefined ? leaves.length - initialCount : 0;

  function approve(id: string) {
    startTransition(async () => {
      try {
        await decideLeave(id);
        toast.success("Leave approved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save decision");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
    <ul className="flex flex-col gap-4">
      {shown.map((l) => {
        const needsPrincipal =
          viewerRole === "class_teacher" && daySpan(l.from_date, l.to_date) > PRINCIPAL_APPROVAL_DAY_SPAN;
        return (
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
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {needsPrincipal ? (
                <span className="text-sm font-medium text-rust">Needs principal approval (over 3 days)</span>
              ) : (
                <button
                  disabled={isPending}
                  onClick={() => approve(l.id)}
                  className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                >
                  Approve
                </button>
              )}
              <button
                disabled={isPending}
                onClick={() => setMessagingId((cur) => (cur === l.id ? null : l.id))}
                className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
              >
                Send message
              </button>
            </div>
          )}

          {messagingId === l.id && (
            <SendMessageForm
              leaveId={l.id}
              reason={l.reason}
              onSent={() => {
                setMessagingId(null);
                toast.success("Message sent to guardian");
              }}
              onError={(msg) => toast.error(msg)}
            />
          )}
        </li>
        );
      })}
      {leaves.length === 0 && <p className="text-base text-slate">{emptyLabel}</p>}
    </ul>
    {hiddenCount > 0 && (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="self-start text-sm font-semibold text-rust hover:underline"
      >
        {expanded ? "See less" : `See ${hiddenCount} more`}
      </button>
    )}
    </div>
  );
}

function SendMessageForm({
  leaveId,
  reason,
  onSent,
  onError,
}: {
  leaveId: string;
  reason: string;
  onSent: () => void;
  onError: (message: string) => void;
}) {
  const [body, setBody] = useState(
    `Please note that your child will miss ${reason} and will have to make up for it somehow.`
  );
  const [isPending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      try {
        await sendLeaveMessage(leaveId, body);
        onSent();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Couldn't send message");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
      />
      <Button size="sm" onClick={send} loading={isPending} disabled={!body.trim()} className="self-start">
        Send
      </Button>
    </div>
  );
}
