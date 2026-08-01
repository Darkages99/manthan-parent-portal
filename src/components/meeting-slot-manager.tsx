"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSlots,
  deleteSlot,
  setMeetingStatus,
  deleteMeeting,
} from "@/app/(staff)/console/ptm/actions";
import { formatClock } from "@/lib/format";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type Slot = Tables<"ptm_slots">;

export function MeetingSlotManager({
  meetingId,
  status,
  slots,
  studentNames,
  guardianNames,
}: {
  meetingId: string;
  status: Enums<"ptm_status">;
  slots: Slot[];
  studentNames: Record<string, string>;
  guardianNames: Record<string, string>;
}) {
  const router = useRouter();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [slotMinutes, setSlotMinutes] = useState(15);
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

      {/* Open slots */}
      <div className="grid gap-4 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">From</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">To</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Slot length</span>
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          >
            {[10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => run(() => createSlots({ meetingId, startTime, endTime, slotMinutes }))}
          disabled={isPending}
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
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-sm border p-4 shadow-[var(--shadow-card)] ${
                  booked ? "border-maroon bg-maroon-tint" : "border-hairline bg-surface"
                }`}
              >
                <div>
                  <p className="text-base font-semibold text-maroon">
                    {formatClock(s.starts_at)} – {formatClock(s.ends_at)}
                  </p>
                  {booked ? (
                    <p className="text-sm text-slate-strong">
                      {s.booked_student_id ? studentNames[s.booked_student_id] : "Booked"}
                      {s.booked_by_guardian_id &&
                        ` · ${guardianNames[s.booked_by_guardian_id] ?? "guardian"}`}
                    </p>
                  ) : (
                    <p className="text-sm text-slate">Open</p>
                  )}
                </div>
                {!booked && (
                  <button
                    disabled={isPending}
                    onClick={() => run(() => deleteSlot(s.id, meetingId))}
                    className="rounded-sm border border-hairline bg-mist px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                  >
                    Remove
                  </button>
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
