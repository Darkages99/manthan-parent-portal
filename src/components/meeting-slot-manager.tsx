"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSlots,
  decidePtmBooking,
  deleteSlot,
  setMeetingStatus,
  deleteMeeting,
} from "@/app/(staff)/console/ptm/actions";
import { ApprovalChain } from "./approval-chain";
import { useToast } from "./toast-provider";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "./icons";
import { formatClock, formatTime } from "@/lib/format";
import { findMyOpenStep } from "@/lib/ptm-approval";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type Slot = Tables<"ptm_slots">;
type ApprovalStep = Tables<"approval_steps">;

export function MeetingSlotManager({
  meetingId,
  status,
  windowStart,
  windowEnd,
  slotMinutes,
  slots,
  studentNames,
  guardianNames,
  approvalSteps,
  viewerStaffId,
  viewerRole,
  assignedAdminId,
}: {
  meetingId: string;
  status: Enums<"ptm_status">;
  windowStart: string | null;
  windowEnd: string | null;
  slotMinutes: number;
  slots: Slot[];
  studentNames: Record<string, string>;
  guardianNames: Record<string, string>;
  approvalSteps: Record<string, ApprovalStep[]>;
  viewerStaffId: string;
  viewerRole: Enums<"role">;
  /** Only this staff member (or a super_admin) may approve/decline slots. */
  assignedAdminId: string | null;
}) {
  const canDecideMeeting = viewerStaffId === assignedAdminId || viewerRole === "super_admin";
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        toast.success("Done");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const ordered = [...slots].sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  const bookedCount = slots.filter((s) => s.booked_by_guardian_id).length;
  const pendingCount = slots.filter((s) => s.pending_guardian_id).length;
  const affectedCount = bookedCount + pendingCount;
  const hasWindow = !!windowStart && !!windowEnd;

  function onDeleteClick() {
    if (affectedCount > 0 && !confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    run(async () => {
      await deleteMeeting(meetingId);
      router.push("/console/ptm");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Meeting controls */}
      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
              status === "open"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {status === "open" ? "Open for booking" : "Closed"}
          </span>
          <button
            onClick={() =>
              run(() => setMeetingStatus(meetingId, status === "open" ? "closed" : "open"))
            }
            disabled={isPending}
            className="rounded-sm border border-hairline bg-mist px-4 py-2 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
          >
            {status === "open" ? "Close meeting" : "Reopen meeting"}
          </button>
          <button
            onClick={onDeleteClick}
            disabled={isPending}
            className="ml-auto rounded-sm border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/50 dark:hover:bg-rose-900/20"
          >
            Delete PTM
          </button>
        </div>

        {confirmingDelete && (
          <div className="flex flex-col gap-3 rounded-sm border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/50 dark:bg-rose-900/20">
            <p className="flex items-start gap-2 text-sm text-rose-800 dark:text-rose-200">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {bookedCount > 0 && pendingCount > 0
                ? `${bookedCount} confirmed and ${pendingCount} pending booking${pendingCount === 1 ? "" : "s"} will be cancelled.`
                : bookedCount > 0
                  ? `${bookedCount} confirmed booking${bookedCount === 1 ? "" : "s"} will be cancelled.`
                  : `${pendingCount} pending booking${pendingCount === 1 ? "" : "s"} will be cancelled.`}
              {" "}Every affected parent gets a push notification that the PTM was cancelled.
            </p>
            <div className="flex gap-2">
              <button
                disabled={isPending}
                onClick={onDeleteClick}
                className="rounded-sm bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isPending ? "Cancelling…" : `Yes, cancel & notify ${affectedCount}`}
              </button>
              <button
                disabled={isPending}
                onClick={() => setConfirmingDelete(false)}
                className="rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon hover:bg-parchment"
              >
                Never mind
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking window */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        <div>
          <p className="font-medium text-maroon">Booking window</p>
          {hasWindow ? (
            <p className="text-base text-slate-strong">
              {formatTime(windowStart!)} – {formatTime(windowEnd!)} · {slotMinutes} min slots
            </p>
          ) : (
            <p className="text-base text-slate">No window was set when this PTM was created.</p>
          )}
        </div>
        <button
          onClick={() => run(() => createSlots(meetingId))}
          disabled={isPending || !hasWindow}
          className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          Open slots
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-4 py-2.5 text-base text-rose-700 dark:border-rose-500/50 dark:bg-rose-900/20 dark:text-rose-200">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Slot list */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl text-maroon">Slots</h2>
          {ordered.length > 0 && (
            <span className="text-sm text-slate">
              {bookedCount} booked
              {pendingCount > 0 && ` · ${pendingCount} awaiting approval`} · {ordered.length - bookedCount - pendingCount} open
            </span>
          )}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((s) => {
            const booked = !!s.booked_by_guardian_id;
            const pending = !!s.pending_guardian_id;
            const steps = approvalSteps[s.id];
            const myStep =
              steps && canDecideMeeting ? findMyOpenStep(steps, viewerRole, viewerStaffId) : null;
            const guardianId = s.booked_by_guardian_id ?? s.pending_guardian_id;

            const accent = booked
              ? "border-l-emerald-500"
              : pending
                ? "border-l-amber-500"
                : "border-l-slate-200 dark:border-l-slate-700";

            return (
              <li
                key={s.id}
                className={`flex flex-col gap-3 rounded-lg border border-hairline border-l-4 bg-surface p-4 shadow-[var(--shadow-card)] ${accent}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-maroon">
                      {formatClock(s.starts_at)} – {formatClock(s.ends_at)}
                    </p>
                    {booked || pending ? (
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-strong">
                        {booked ? (
                          <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <ClockIcon className="h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        <span className="truncate">
                          {s.booked_student_id ? studentNames[s.booked_student_id] : "Booked"}
                          {guardianId && ` · ${guardianNames[guardianId] ?? "guardian"}`}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate">Open</p>
                    )}
                  </div>
                  {!booked && !pending && (
                    <button
                      disabled={isPending}
                      onClick={() => run(() => deleteSlot(s.id, meetingId))}
                      className="shrink-0 rounded-sm border border-hairline bg-mist px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {steps && steps.length > 0 && (
                  <div className="border-t border-hairline pt-3">
                    <ApprovalChain steps={steps} highlightStepId={myStep?.id} />
                    {myStep && (
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={isPending}
                          onClick={() => run(() => decidePtmBooking(s.id, meetingId, "approved"))}
                          className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => run(() => decidePtmBooking(s.id, meetingId, "declined"))}
                          className="rounded-sm border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/50 dark:hover:bg-rose-900/20"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {ordered.length === 0 && (
            <li className="text-base text-slate">No slots opened yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
