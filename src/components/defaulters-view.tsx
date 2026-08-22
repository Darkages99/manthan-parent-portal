"use client";

import { useState } from "react";
import { ChildTabs } from "./child-tabs";
import type { Tables } from "@/lib/supabase/database.types";

type Student = Tables<"students">;
type DefaulterRecord = Tables<"defaulter_records">;

export function DefaultersView({
  students,
  recordsByStudent,
}: {
  students: Student[];
  recordsByStudent: Record<string, DefaulterRecord[]>;
}) {
  const [activeId, setActiveId] = useState(students[0]?.id);
  const records = (recordsByStudent[activeId] ?? []).slice().sort((a, b) =>
    a.incident_date < b.incident_date ? 1 : -1
  );

  return (
    <div className="flex flex-col gap-6">
      <ChildTabs students={students} activeId={activeId} onSelect={setActiveId} />

      {records.length === 0 ? (
        <div className="rounded-sm border border-hairline bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-lg text-slate-strong">No incidents on record. Clean sheet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((r) => (
            <li
              key={r.id}
              className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-heading text-lg text-maroon">{r.description}</p>
                <p className="shrink-0 text-sm text-slate">
                  {new Date(r.incident_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              {r.action_taken && (
                <p className="mt-2 text-sm text-slate-strong">
                  <span className="font-semibold">Action taken:</span> {r.action_taken}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
