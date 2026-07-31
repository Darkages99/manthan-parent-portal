"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestLeave } from "@/app/(parent)/leave/actions";
import type { Tables } from "@/lib/supabase/database.types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream transition hover:bg-maroon-strong disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit request"}
    </button>
  );
}

export function LeaveForm({ students }: { students: Tables<"students">[] }) {
  const [open, setOpen] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    try {
      await requestLeave(formData);
      setJustSent(true);
      setOpen(false);
      setTimeout(() => setJustSent(false), 4000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-sm bg-maroon px-4 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong"
        >
          Request leave
        </button>
        {justSent && <span className="text-base text-emerald-700">Leave request submitted.</span>}
      </div>
    );
  }

  return (
    <form
      action={handleAction}
      className="grid gap-5 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
        <span className="font-medium text-maroon">Child</span>
        <select name="studentId" required className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base">
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">From</span>
        <input type="date" name="fromDate" required className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base" />
      </label>
      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">To</span>
        <input type="date" name="toDate" required className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base" />
      </label>

      <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
        <span className="font-medium text-maroon">Reason</span>
        <textarea
          name="reason"
          required
          rows={2}
          placeholder="e.g. Travelling for a family wedding"
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
        />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
        >
          Cancel
        </button>
        {error && <span className="text-base text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
