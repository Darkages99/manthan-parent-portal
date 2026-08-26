"use client";

import { useState } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { PeriodEditorBody } from "./period-editor";
import { useToast } from "./toast-provider";
import { ClockIcon, DownloadIcon } from "./icons";
import type { Period } from "@/lib/timetable";

/**
 * Top-right authoring controls for the timetable (principal only):
 *  - "Period structure" opens the period editor in a dialog.
 *  - "Import CSV" is flagged off until the CSV format is finalised — it just
 *    shows an in-app notice for now (see also FLAG note on all CSV imports).
 */
export function TimetableAuthoringTools({ periods }: { periods: Period[] }) {
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<ClockIcon className="h-4 w-4" />}
        onClick={() => setPeriodsOpen(true)}
      >
        Period structure
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<DownloadIcon className="h-4 w-4 rotate-180" />}
        onClick={() => toast.error("CSV format must be finalised before this feature is enabled.")}
      >
        Import CSV
      </Button>

      <Dialog open={periodsOpen} onClose={() => setPeriodsOpen(false)} title="Period structure">
        <p className="mb-3 text-sm text-slate">Applies to every class, Mon–Sat.</p>
        <PeriodEditorBody periods={periods} />
      </Dialog>
    </div>
  );
}
