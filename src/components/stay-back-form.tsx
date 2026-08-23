"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { raiseStayBack } from "@/app/(parent)/stay-back/actions";
import type { Tables } from "@/lib/supabase/database.types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream transition hover:bg-maroon-strong disabled:opacity-60"
    >
      {pending ? "Sending…" : "Agree & continue"}
    </button>
  );
}

export function StayBackForm({
  students,
  teachers,
}: {
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
}) {
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    try {
      await raiseStayBack(formData);
      setJustSent(true);
      setTimeout(() => setJustSent(false), 4000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form
      action={handleAction}
      className="grid gap-5 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5 text-base">
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
        <span className="font-medium text-maroon">Teacher to notify</span>
        <select name="teacherId" required className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base">
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
        <span className="font-medium text-maroon">Purpose / reason</span>
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="e.g. Extra basketball practice before the inter-school match"
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Date</span>
        <input type="date" name="date" required className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">From</span>
          <input
            type="time"
            name="fromTime"
            required
            defaultValue="16:00"
            className="w-full rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base leading-none [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">To</span>
          <input
            type="time"
            name="toTime"
            required
            defaultValue="17:00"
            className="w-full rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base leading-none [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-base sm:col-span-2">
        <input
          type="checkbox"
          name="foodTransportAgreed"
          required
          className="mt-0.5 h-5 w-5 shrink-0 accent-rust"
        />
        <span>I agree to arrange for food and transportation for my child.</span>
      </label>

      <div className="sm:col-span-2">
        <SubmitButton />
        {justSent && (
          <span className="ml-3 text-base text-emerald-700">
            Sent — the teacher and principal have been notified.
          </span>
        )}
        {error && <span className="ml-3 text-base text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
