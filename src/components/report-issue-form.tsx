"use client";

import { useRef, useState } from "react";
import { reportIssue } from "@/app/(parent)/report-issue/actions";
import { Button } from "@/components/button";
import { SegmentedControl } from "@/components/filter-bar";
import { TypeaheadPicker, type TypeaheadOption } from "@/components/typeahead-picker";
import { useToast } from "@/components/toast-provider";

type VisibilityMode = "front_office_and_principal" | "principal_only" | "teacher";

const MODE_OPTIONS = [
  { value: "front_office_and_principal" as const, label: "Front office + principal" },
  { value: "principal_only" as const, label: "Principal only" },
  { value: "teacher" as const, label: "A specific teacher" },
];

const MODE_HINTS: Record<VisibilityMode, string> = {
  front_office_and_principal: "Visible to the front office and the principal.",
  principal_only: "Visible to the principal only.",
  teacher: "Visible to the chosen teacher(s), the front office and the principal.",
};

export function ReportIssueForm({ teachers }: { teachers: TypeaheadOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<VisibilityMode>("front_office_and_principal");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function handleAction(formData: FormData) {
    setError(null);
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!subject || !body) {
      setError("Subject and details are required");
      return;
    }
    if (mode === "teacher" && recipients.length === 0) {
      setError("Choose at least one teacher to direct this to");
      return;
    }

    setPending(true);
    try {
      await reportIssue({
        subject,
        body,
        audience: mode === "principal_only" ? "principal_only" : "front_office_and_principal",
        recipientStaffIds: mode === "teacher" ? recipients : [],
      });
      toast.celebrate("Report submitted");
      formRef.current?.reset();
      setMode("front_office_and_principal");
      setRecipients([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
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

      <div className="flex flex-col gap-2 text-base">
        <span className="font-medium text-maroon">Who can see this?</span>
        <SegmentedControl<VisibilityMode>
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          ariaLabel="Report visibility"
        />
        <span className="text-sm text-slate">{MODE_HINTS[mode]}</span>
      </div>

      {mode === "teacher" && (
        <div className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Teacher(s)</span>
          <TypeaheadPicker
            options={teachers}
            selected={recipients}
            onChange={setRecipients}
            placeholder="Search teachers…"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} className="px-5 py-2.5">
          Submit report
        </Button>
        {error && <span className="text-base text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
