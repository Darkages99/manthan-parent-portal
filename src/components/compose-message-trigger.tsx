"use client";

import { useState } from "react";
import { ComposeForm } from "./compose-form";
import { Dialog } from "./dialog";
import { PlusIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type StudentOption = { id: string; label: string; classSectionId: string };
type GroupOption = { id: string; name: string };

/** Top-right "Compose message" button that opens ComposeForm in a popup. */
export function ComposeMessageTrigger({
  classSections,
  students,
  groups,
  isTeacher,
}: {
  classSections: Tables<"class_sections">[];
  students: StudentOption[];
  groups: GroupOption[];
  isTeacher: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist"
      >
        <PlusIcon className="h-4 w-4" />
        Compose message
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Compose message">
        <ComposeForm
          classSections={classSections}
          students={students}
          groups={groups}
          isTeacher={isTeacher}
        />
      </Dialog>
    </>
  );
}
