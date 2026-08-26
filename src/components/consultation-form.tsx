"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestConsultation } from "@/app/(parent)/consultations/actions";
import { Button } from "@/components/button";
import { ComboBox } from "@/components/combobox";
import { useToast } from "@/components/toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="px-5 py-2.5">
      Request consultation
    </Button>
  );
}

export function ConsultationForm({ students }: { students: Tables<"students">[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const toast = useToast();

  async function handleAction(formData: FormData) {
    setError(null);
    try {
      await requestConsultation(formData);
      toast.celebrate("Consultation request sent");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-fit px-4 py-2.5">
        Request a consultation
      </Button>
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
          options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
          value={studentId}
          onChange={setStudentId}
          placeholder="Choose child…"
          ariaLabel="Child"
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base text-slate-strong"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Preferred date</span>
        <input
          type="date"
          name="preferredDate"
          required
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
        />
        <span className="text-sm text-slate">Tuesdays and Thursdays only.</span>
      </label>

      <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
        <span className="font-medium text-maroon">When are you free that day?</span>
        <textarea
          name="availabilityNote"
          required
          rows={2}
          placeholder="e.g. Anytime after 4pm, or only mornings before 10am"
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
