"use client";

import { useTransition } from "react";
import { StatusPill } from "@/components/status-pill";
import { cancelConsultation } from "@/app/(parent)/consultations/actions";
import { formatDate, formatTime } from "@/lib/format";
import { useToast } from "@/components/toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Consultation = Tables<"parent_consultations">;

export function ConsultationList({
  consultations,
  studentNames,
}: {
  consultations: Consultation[];
  studentNames: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function cancel(id: string) {
    startTransition(async () => {
      try {
        await cancelConsultation(id);
        toast.success("Request cancelled");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't cancel");
      }
    });
  }

  if (consultations.length === 0) {
    return <p className="text-base text-slate">No consultation requests yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {consultations.map((c) => (
        <li key={c.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-maroon">
                {studentNames[c.student_id] ?? "Student"} — {formatDate(c.preferred_date)}
              </p>
              <p className="mt-1 text-base text-slate-strong">
                {c.status === "scheduled" && c.scheduled_time
                  ? `Scheduled for ${formatTime(c.scheduled_time)}`
                  : `You're free: ${c.availability_note}`}
              </p>
              {c.decision_note && <p className="mt-1 text-sm text-slate">{c.decision_note}</p>}
            </div>
            <StatusPill status={c.status} />
          </div>
          {c.status === "pending" && (
            <button
              disabled={isPending}
              onClick={() => cancel(c.id)}
              className="mt-3 rounded-sm border border-hairline bg-mist px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
            >
              Cancel request
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
