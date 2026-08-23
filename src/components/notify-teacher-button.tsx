"use client";

import { useState, useTransition } from "react";
import { notifyTeacherToMarkAttendance } from "@/app/(staff)/console/attendance/actions";

export function NotifyTeacherButton({ classSectionId }: { classSectionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        await notifyTeacherToMarkAttendance(classSectionId);
        setSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't notify the teacher");
      }
    });
  }

  if (sent) {
    return <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Teacher notified</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-sm border border-rose-300 bg-cream px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/50 dark:bg-transparent"
      >
        {isPending ? "Sending…" : "Notify teacher"}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
