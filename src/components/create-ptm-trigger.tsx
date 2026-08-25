"use client";

import { useState } from "react";
import { CreatePtmForm } from "./create-ptm-form";
import { Dialog } from "./dialog";
import { PlusIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type StaffOption = { id: string; name: string };

/** Top-right "Create PTM" button that opens CreatePtmForm in a popup. */
export function CreatePtmTrigger({
  classes,
  teachers,
  admins,
}: {
  classes: ClassSection[];
  teachers: StaffOption[];
  admins: StaffOption[];
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
        Create PTM
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Create a PTM">
        <CreatePtmForm classes={classes} teachers={teachers} admins={admins} />
      </Dialog>
    </>
  );
}
