"use client";

import { useState, useTransition } from "react";
import { confirmPendingDeletion } from "@/app/(staff)/console/sync/pending-deletions/actions";
import { formatSlotTime } from "@/lib/format";
import { PENDING_DELETION_SUBJECT_LABEL, pendingDeletionLabel } from "@/lib/pending-deletion-label";
import type { Tables } from "@/lib/supabase/database.types";

type PendingDeletion = Tables<"sheet_sync_pending_deletions">;

export function PendingDeletionsList({
  pending,
  canConfirm,
}: {
  pending: PendingDeletion[];
  canConfirm: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onConfirm(id: string) {
    setErrors((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      try {
        await confirmPendingDeletion(id);
      } catch (e) {
        setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Couldn't delete" }));
      }
    });
  }

  if (pending.length === 0) {
    return <p className="text-base text-slate">Nothing waiting for review.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {pending.map((row) => (
        <li key={row.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-maroon">
                {PENDING_DELETION_SUBJECT_LABEL[row.subject_type] ?? row.subject_type} —{" "}
                {pendingDeletionLabel(row.subject_id, row.sheet_row_snapshot)}
              </p>
              <p className="mt-1 text-sm text-slate">
                Missing from the sheet since {formatSlotTime(row.detected_at)}
              </p>
            </div>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-rust">Last known values</summary>
            <pre className="mt-2 overflow-x-auto rounded-sm bg-mist p-3 text-xs text-slate-strong">
              {JSON.stringify(row.sheet_row_snapshot, null, 2)}
            </pre>
          </details>

          {canConfirm && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                disabled={isPending}
                onClick={() => onConfirm(row.id)}
                className="rounded-sm bg-rose-700 px-4 py-2 text-base font-semibold text-cream hover:bg-rose-800 disabled:opacity-60"
              >
                Confirm delete
              </button>
              {errors[row.id] && <span className="text-sm text-rose-600">{errors[row.id]}</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
