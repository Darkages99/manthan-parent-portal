"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { reportIssue } from "@/app/(parent)/report-issue/actions";
import { Button } from "@/components/button";
import { useToast } from "@/components/toast-provider";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="px-5 py-2.5">
      Submit report
    </Button>
  );
}

export function ReportIssueForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function handleAction(formData: FormData) {
    setError(null);
    try {
      await reportIssue(formData);
      toast.celebrate("Report submitted");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 4000);
      formRef.current?.reset();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="grid gap-5 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]"
    >
      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Subject</span>
        <input
          type="text"
          name="subject"
          required
          placeholder="A short summary of the issue"
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Details</span>
        <textarea
          name="body"
          required
          rows={4}
          placeholder="Describe what happened"
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
        />
      </label>

      <label className="flex items-start gap-2.5 text-base">
        <input type="checkbox" name="confidential" className="mt-1" />
        <span>
          Mark confidential
          <span className="block text-sm text-slate">
            Confidential reports are visible only to the principal. Non-confidential reports are
            visible to any staff member for triage.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {justSent && <span className="text-base text-emerald-700">Report submitted.</span>}
        {error && <span className="text-base text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
