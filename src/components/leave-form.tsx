"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestLeave } from "@/app/(parent)/leave/actions";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combobox";
import { useToast } from "@/components/toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="px-5 py-2.5">
      Submit request
    </Button>
  );
}

export function LeaveForm({ students }: { students: Tables<"students">[] }) {
  const [open, setOpen] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const toast = useToast();

  async function handleAction(formData: FormData) {
    setError(null);
    try {
      await requestLeave(formData);
      toast.celebrate("Leave request submitted");
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
        <Button onClick={() => setOpen(true)} className="shrink-0 px-4 py-2.5">
          Request leave
        </Button>
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
        <ComboBox
          name="studentId"
          required
          options={students.map((s) => ({
            value: s.id,
            label: `${s.first_name} ${s.last_name}`,
          }))}
          value={studentId}
          onChange={setStudentId}
          placeholder="Choose child…"
          ariaLabel="Child"
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base text-slate-strong"
        />
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
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="px-4 py-2.5">
          Cancel
        </Button>
        {error && <span className="text-base text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
