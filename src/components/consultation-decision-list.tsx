"use client";

import { useState, useTransition } from "react";
import { StatusPill } from "@/components/status-pill";
import { decideConsultation } from "@/app/(staff)/console/consultations/actions";
import { formatDate, formatTime } from "@/lib/format";
import { useToast } from "@/components/toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Consultation = Tables<"parent_consultations">;

export function ConsultationDecisionList({
  consultations,
  studentNames,
  guardianNames,
  canDecide,
  emptyLabel = "No consultation requests.",
}: {
  consultations: Consultation[];
  studentNames: Record<string, string>;
  guardianNames: Record<string, string>;
  canDecide: boolean;
  emptyLabel?: string;
}) {
  if (consultations.length === 0) {
    return <p className="text-base text-slate">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {consultations.map((c) => (
        <ConsultationRow
          key={c.id}
          consultation={c}
          studentName={studentNames[c.student_id] ?? "Student"}
          guardianName={guardianNames[c.requested_by] ?? "guardian"}
          canDecide={canDecide}
        />
      ))}
    </ul>
  );
}

function ConsultationRow({
  consultation: c,
  studentName,
  guardianName,
  canDecide,
}: {
  consultation: Consultation;
  studentName: string;
  guardianName: string;
  canDecide: boolean;
}) {
  const [scheduledTime, setScheduledTime] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function schedule() {
    if (!scheduledTime) {
      toast.error("Pick a time first");
      return;
    }
    startTransition(async () => {
      try {
        await decideConsultation(c.id, "scheduled", scheduledTime, note);
        toast.success("Consultation scheduled");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function decline() {
    startTransition(async () => {
      try {
        await decideConsultation(c.id, "declined", undefined, note);
        toast.success("Request declined");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <li className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-maroon">
            {studentName} — {formatDate(c.preferred_date)}
          </p>
          <p className="mt-1 text-base text-slate-strong">
            Requested by {guardianName} · Free: {c.availability_note}
          </p>
          {c.status === "scheduled" && c.scheduled_time && (
            <p className="mt-1 text-base text-emerald-700">Scheduled for {formatTime(c.scheduled_time)}</p>
          )}
          {c.decision_note && <p className="mt-1 text-sm text-slate">{c.decision_note}</p>}
        </div>
        <StatusPill status={c.status} />
      </div>

      {c.status === "pending" && canDecide && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-maroon">Time</span>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="rounded-sm border border-hairline bg-mist px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-1 min-w-[10rem] flex-col gap-1 text-sm">
            <span className="font-medium text-maroon">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please come to the front office"
              className="rounded-sm border border-hairline bg-mist px-2.5 py-1.5 text-sm"
            />
          </label>
          <button
            disabled={isPending}
            onClick={schedule}
            className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
          >
            Schedule
          </button>
          <button
            disabled={isPending}
            onClick={decline}
            className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}
      {c.status === "pending" && !canDecide && (
        <p className="mt-3 text-sm text-slate">Awaiting front office or principal.</p>
      )}
    </li>
  );
}
