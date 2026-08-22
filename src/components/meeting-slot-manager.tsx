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
import { ApprovalChecklist } from "./approval-checklist";
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
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const ordered = [...slots].sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  const bookedCount = slots.filter((s) => s.booked_by_guardian_id).length;
  const hasWindow = !!windowStart && !!windowEnd;

  return (
    <div className="flex flex-col gap-6">
      {/* Meeting controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            run(() => setMeetingStatus(meetingId, status === "open" ? "closed" : "open"))
          }
          disabled={isPending}
          className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
        >
          {status === "open" ? "Close meeting" : "Reopen meeting"}
        </button>
        <button
          onClick={() =>
            run(async () => {
              await deleteMeeting(meetingId);
              router.push("/console/ptm");
            })
          }
          disabled={isPending || bookedCount > 0}
          title={bookedCount > 0 ? "Some slots are booked" : undefined}
          className="rounded-sm border border-rose-300 px-4 py-2 text-base font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/50 dark:hover:bg-rose-900/20"
        >
          Delete PTM
        </button>
      </div>

      {/* Open slots from the meeting's own window */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
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

      {error && <p className="text-base text-rose-700">{error}</p>}

      {/* Slot list */}
      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">
          Slots{ordered.length > 0 && ` · ${bookedCount}/${ordered.length} booked`}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ordered.map((s) => {
            const booked = !!s.booked_by_guardian_id;
            const pending = !!s.pending_guardian_id;
            const steps = approvalSteps[s.id];
            const myStep = steps ? findMyOpenStep(steps, viewerRole, viewerStaffId) : null;
            const guardianId = s.booked_by_guardian_id ?? s.pending_guardian_id;
            return (
              <li
                key={s.id}
                className={`flex flex-col gap-3 rounded-sm border p-4 shadow-[var(--shadow-card)] ${
                  booked || pending ? "border-maroon bg-maroon-tint" : "border-hairline bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-maroon">
                      {formatClock(s.starts_at)} – {formatClock(s.ends_at)}
                    </p>
                    {booked || pending ? (
                      <p className="text-sm text-slate-strong">
                        {s.booked_student_id ? studentNames[s.booked_student_id] : "Booked"}
                        {guardianId && ` · ${guardianNames[guardianId] ?? "guardian"}`}
                        {pending && !booked && " · awaiting approval"}
                      </p>
                    ) : (
                      <p className="text-sm text-slate">Open</p>
                    )}
                  </div>
                  {!booked && !pending && (
                    <button
                      disabled={isPending}
                      onClick={() => run(() => deleteSlot(s.id, meetingId))}
                      className="rounded-sm border border-hairline bg-mist px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {steps && steps.length > 0 && (
                  <div className="border-t border-hairline pt-3">
                    <ApprovalChecklist steps={steps} />
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
