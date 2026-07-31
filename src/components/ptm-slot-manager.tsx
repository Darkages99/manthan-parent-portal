"use client";

import { useState, useTransition } from "react";
import { createSlots, deleteSlot } from "@/app/(staff)/console/ptm/actions";
import { formatDate, formatClock } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type Slot = Tables<"ptm_slots">;

export function PtmSlotManager({
  classes,
  slots,
  studentNames,
  guardianNames,
}: {
  classes: ClassSection[];
  slots: Slot[];
  studentNames: Record<string, string>;
  guardianNames: Record<string, string>;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const classSlots = slots
    .filter((s) => s.class_section_id === classId)
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-3">
        {classes.length > 1 && (
          <label className="flex flex-col gap-1.5 text-base">
            <span className="font-medium text-maroon">Class</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Grade {c.grade} - {c.section}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Slot length</span>
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          >
            {[10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">From</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">To</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={() =>
              run(() => createSlots({ classSectionId: classId, date, startTime, endTime, slotMinutes }))
            }
            disabled={isPending || !date}
            className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
          >
            Open slots
          </button>
        </div>
      </div>

      {error && <p className="text-base text-rose-700">{error}</p>}

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">
          Slots{classSlots.length > 0 && ` · ${formatDate(classSlots[0].starts_at)}`}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {classSlots.map((s) => {
            const booked = !!s.booked_by_guardian_id;
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-sm border p-4 shadow-[var(--shadow-card)] ${
                  booked ? "border-maroon bg-maroon-tint" : "border-hairline bg-surface"
                }`}
              >
                <div>
                  <p className="text-base font-semibold text-maroon">
                    {formatClock(s.starts_at)} – {formatClock(s.ends_at)}
                  </p>
                  {booked ? (
                    <p className="text-sm text-slate-strong">
                      {s.booked_student_id ? studentNames[s.booked_student_id] : "Booked"}
                      {s.booked_by_guardian_id &&
                        ` · ${guardianNames[s.booked_by_guardian_id] ?? "guardian"}`}
                    </p>
                  ) : (
                    <p className="text-sm text-slate">Open</p>
                  )}
                </div>
                {!booked && (
                  <button
                    disabled={isPending}
                    onClick={() => run(() => deleteSlot(s.id))}
                    className="rounded-sm border border-hairline bg-mist px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
          {classSlots.length === 0 && (
            <li className="text-base text-slate">No slots opened for this class yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
