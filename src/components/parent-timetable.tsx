"use client";

import { useState } from "react";
import { ChildTabs } from "./child-tabs";
import { TimetableGrid, type GridCell } from "./timetable-grid";
import type { Period } from "@/lib/timetable";

type Child = { id: string; first_name: string; last_name: string; classSectionId: string | null };

/**
 * Parent-facing timetable: switch between children and see each one's class
 * timetable. Cells are precomputed per class on the server.
 */
export function ParentTimetable({
  students,
  periods,
  cellsByClass,
}: {
  students: Child[];
  periods: Period[];
  cellsByClass: Record<string, Record<string, GridCell>>;
}) {
  const [activeId, setActiveId] = useState(students[0]?.id ?? "");
  const active = students.find((s) => s.id === activeId) ?? students[0];
  const cells = (active?.classSectionId && cellsByClass[active.classSectionId]) || {};

  return (
    <div className="flex flex-col gap-6">
      <ChildTabs students={students} activeId={activeId} onSelect={setActiveId} />
      <TimetableGrid
        periods={periods}
        cells={cells}
        emptyLabel="No timetable has been published for this class yet."
      />
    </div>
  );
}
