"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/app/(staff)/console/ptm/actions";
import { ComboBox } from "./combobox";
import { Button } from "./button";
import { PlusIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;

const SLOT_OPTIONS = [7, 10, 15, 20, 30];
/** Grades above this get the longer default slot; at/below get the shorter one. */
const SHORT_SLOT_MAX_GRADE = 5;
const SHORT_SLOT_MINUTES = 7;
const LONG_SLOT_MINUTES = 10;

/** Parses the leading integer off a grade label (e.g. "5", "Grade 5", "5A")
 * so the default slot length can vary by grade; falls back to the longer
 * default when the grade doesn't parse. */
function defaultSlotMinutesForGrade(grade: string): number {
  const n = parseInt(grade, 10);
  if (Number.isNaN(n)) return LONG_SLOT_MINUTES;
  return n <= SHORT_SLOT_MAX_GRADE ? SHORT_SLOT_MINUTES : LONG_SLOT_MINUTES;
}

/** Creates a PTM meeting for a class + date, then jumps to its slot page.
 * Only rendered for super_admin/principal — see console/ptm/page.tsx. Booking
 * is plain first-come-first-served; the class's own class teacher takes the
 * meeting, no separate assignment needed. */
export function CreatePtmForm({ classes }: { classes: ClassSection[] }) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("11:00");
  const [slotMinutes, setSlotMinutes] = useState(defaultSlotMinutesForGrade(classes[0]?.grade ?? ""));
  const [slotTouched, setSlotTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClassChange(next: string) {
    setClassId(next);
    if (!slotTouched) {
      const grade = classes.find((c) => c.id === next)?.grade ?? "";
      setSlotMinutes(defaultSlotMinutesForGrade(grade));
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await createMeeting({
          classSectionId: classId,
          meetingDate: date,
          title,
          windowStart,
          windowEnd,
          slotMinutes,
        });
        router.push(`/console/ptm/${id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (classes.length === 0) {
    return <p className="text-base text-slate">No classes yet.</p>;
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-xl text-maroon">Create a PTM</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Class</span>
          <ComboBox
            options={classes.map((c) => ({
              value: c.id,
              label: `Grade ${c.grade} - ${c.section}`,
            }))}
            value={classId}
            onChange={onClassChange}
            required
            placeholder="Search class…"
            ariaLabel="Class"
            recallKey="ptm-class"
          />
        </label>
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
          <span className="font-medium text-maroon">Title (optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Term 2 PTM"
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Window from</span>
          <input
            type="time"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Window to</span>
          <input
            type="time"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Slot length</span>
          <select
            value={slotMinutes}
            onChange={(e) => {
              setSlotTouched(true);
              setSlotMinutes(Number(e.target.value));
            }}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          >
            {SLOT_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        onClick={submit}
        loading={isPending}
        disabled={!classId || !date}
        icon={<PlusIcon className="h-5 w-5" />}
        className="mt-4 px-5 py-2.5"
      >
        Create PTM
      </Button>
      {error && <p className="mt-3 text-base text-rose-700">{error}</p>}
    </div>
  );
}
