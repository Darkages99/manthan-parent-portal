"use client";

import { useState, useTransition } from "react";
import { ChildTabs } from "./child-tabs";
import { bookSlot, cancelSlot } from "@/app/(parent)/ptm/actions";
import { formatSlotTime, formatClock } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

type Student = Tables<"students"> & { classSection: Tables<"class_sections"> | null };
type Slot = Tables<"ptm_slots">;

export function PtmView({
  students,
  slots,
  teacherNames,
}: {
  students: Student[];
  slots: Slot[];
  teacherNames: Record<string, string>;
}) {
  const [activeId, setActiveId] = useState(students[0]?.id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = students.find((s) => s.id === activeId);
  const classId = active?.classSection?.id;

  const classSlots = slots
    .filter((s) => s.class_section_id === classId)
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));

  const myBooking = classSlots.find((s) => s.booked_student_id === activeId);
  const teacherName = classSlots[0] ? teacherNames[classSlots[0].teacher_id] : undefined;

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

  return (
    <div className="flex flex-col gap-6">
      <ChildTabs students={students} activeId={activeId} onSelect={setActiveId} />

      <div className="rounded-sm border border-hairline bg-mist px-5 py-4">
        <p className="text-base text-slate-strong">
          {active && (
            <>
              Parent–teacher meeting for{" "}
              <span className="font-semibold text-maroon">{active.first_name}</span>
              {active.classSection && ` (Grade ${active.classSection.grade} - ${active.classSection.section})`}
              {teacherName && (
                <>
                  {" "}
                  with <span className="font-semibold text-maroon">{teacherName}</span>
                </>
              )}
              .
            </>
          )}
        </p>
        {myBooking && (
          <p className="mt-1 text-base text-emerald-700">
            You&apos;re booked for {formatSlotTime(myBooking.starts_at)}.
          </p>
        )}
      </div>

      {error && <p className="text-base text-rose-700">{error}</p>}

      {classSlots.length === 0 ? (
        <p className="text-base text-slate">No slots have been opened for this class yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classSlots.map((s) => {
            const mine = s.booked_student_id === activeId;
            const takenByOther = !!s.booked_by_guardian_id && !mine;
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-sm border p-4 shadow-[var(--shadow-card)] ${
                  mine ? "border-maroon bg-maroon-tint" : "border-hairline bg-surface"
                }`}
              >
                <div>
                  <p className="text-base font-semibold text-maroon">
                    {formatClock(s.starts_at)} – {formatClock(s.ends_at)}
                  </p>
                  {takenByOther && <p className="text-sm text-slate">Booked</p>}
                </div>
                {mine ? (
                  <button
                    disabled={isPending}
                    onClick={() => run(() => cancelSlot(s.id))}
                    className="rounded-sm border border-hairline bg-surface px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    disabled={isPending || takenByOther || !!myBooking}
                    onClick={() => run(() => bookSlot(s.id, activeId))}
                    className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-40"
                  >
                    {takenByOther ? "Taken" : "Book"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {myBooking && (
        <p className="text-sm text-slate">
          One slot per child — cancel your current booking to choose a different time.
        </p>
      )}
    </div>
  );
}
