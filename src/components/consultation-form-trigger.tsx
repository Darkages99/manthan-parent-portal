"use client";

import { useState } from "react";
import { ConsultationForm } from "./consultation-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
import type { Tables } from "@/lib/supabase/database.types";

/** Top-right-style "Request a consultation" button that opens ConsultationForm in a popup. */
export function ConsultationFormTrigger({ students }: { students: Tables<"students">[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CreateFab label="Request a consultation" onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title="Request a consultation">
        <ConsultationForm students={students} onSuccess={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
