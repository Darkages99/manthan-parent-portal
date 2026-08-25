"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { raiseStayBack } from "@/app/(parent)/stay-back/actions";
import { TRANSPORT_PARENT_ARRANGED, TRANSPORT_SELF_RETURN } from "@/lib/stay-back-transport";
import { Button } from "@/components/button";
import { useToast } from "@/components/toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" loading={pending} className="px-5 py-2.5">
      Agree & continue
    </Button>
  );
}

export function StayBackForm({
  students,
  teachers,
  defaultTransport,
}: {
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
  /** The guardian's most recent choice, so the toggle defaults to what they picked last time. */
  defaultTransport?: string | null;
}) {
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modeOfTransport, setModeOfTransport] = useState(
    defaultTransport === TRANSPORT_SELF_RETURN ? TRANSPORT_SELF_RETURN : TRANSPORT_PARENT_ARRANGED
  );
  const toast = useToast();

  async function handleAction(formData: FormData) {
    setError(null);
    try {
      await raiseStayBack(formData);
      toast.celebrate("Request sent — teacher & principal notified");
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

      <div className="flex flex-col gap-1.5 text-base sm:col-span-2">
        <span className="font-medium text-maroon">Getting home</span>
        <input type="hidden" name="modeOfTransport" value={modeOfTransport} />
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setModeOfTransport(TRANSPORT_PARENT_ARRANGED)}
            aria-pressed={modeOfTransport === TRANSPORT_PARENT_ARRANGED}
            className={`rounded-sm border px-4 py-2.5 text-left text-base font-medium transition ${
              modeOfTransport === TRANSPORT_PARENT_ARRANGED
                ? "border-rust bg-rust/10 text-maroon"
                : "border-hairline bg-mist text-slate-strong hover:border-rust/50"
            }`}
          >
            I will arrange for my child&apos;s transport
          </button>
          <button
            type="button"
            onClick={() => setModeOfTransport(TRANSPORT_SELF_RETURN)}
            aria-pressed={modeOfTransport === TRANSPORT_SELF_RETURN}
            className={`rounded-sm border px-4 py-2.5 text-left text-base font-medium transition ${
              modeOfTransport === TRANSPORT_SELF_RETURN
                ? "border-rust bg-rust/10 text-maroon"
                : "border-hairline bg-mist text-slate-strong hover:border-rust/50"
            }`}
          >
            My child will return home on their own
          </button>
        </div>
      </div>

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
