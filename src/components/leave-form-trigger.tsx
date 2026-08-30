"use client";

import { useState } from "react";
import { LeaveForm } from "./leave-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
import type { Tables } from "@/lib/supabase/database.types";

/** Top-right-style "Request leave" button that opens LeaveForm in a popup. */
export function LeaveFormTrigger({ students }: { students: Tables<"students">[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CreateFab label="Request leave" onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title="Request leave">
        <LeaveForm students={students} onSuccess={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
