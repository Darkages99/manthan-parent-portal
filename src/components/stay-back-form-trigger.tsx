"use client";

import { useState } from "react";
import { StayBackForm } from "./stay-back-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
import type { Tables } from "@/lib/supabase/database.types";

/** Top-right-style "Raise a stay-back request" button that opens StayBackForm in a popup. */
export function StayBackFormTrigger({
  students,
  teachers,
  defaultTransport,
}: {
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
  defaultTransport?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CreateFab label="Raise a stay-back request" onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title="Stay-back consent request">
        <StayBackForm students={students} teachers={teachers} defaultTransport={defaultTransport} />
      </Dialog>
    </>
  );
}
