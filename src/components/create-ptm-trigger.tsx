"use client";

import { useState } from "react";
import { CreatePtmForm } from "./create-ptm-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
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
      <CreateFab label="Create PTM" onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title="Create a PTM">
        <CreatePtmForm classes={classes} teachers={teachers} admins={admins} />
      </Dialog>
    </>
  );
}
