"use client";

import { useState } from "react";
import { ComposeForm } from "./compose-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
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
      <CreateFab label="Compose message" onClick={() => setOpen(true)} />
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
