"use client";

import { useState } from "react";
import { ReportIssueForm } from "./report-issue-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
import type { TypeaheadOption } from "./typeahead-picker";

/** Top-right-style "Report an issue" button that opens ReportIssueForm in a popup. */
export function ReportIssueFormTrigger({ teachers }: { teachers: TypeaheadOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CreateFab label="Report an issue" onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title="Report an issue">
        <ReportIssueForm teachers={teachers} />
      </Dialog>
    </>
  );
}
