"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/app/(staff)/console/ptm/actions";
import { TypeaheadPicker, type TypeaheadOption } from "./typeahead-picker";
import { ComboBox } from "./combobox";
import { Button } from "./button";
import { PlusIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type StaffOption = { id: string; name: string };

/** Creates a PTM meeting for a class + date, then jumps to its slot page.
 * Only rendered for super_admin/principal — see console/ptm/page.tsx. */
export function CreatePtmForm({
  classes,
  teachers,
  admins,
}: {
  classes: ClassSection[];
  teachers: StaffOption[];
  admins: StaffOption[];
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("11:00");
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [teacherTouched, setTeacherTouched] = useState(false);
  const [adminId, setAdminId] = useState(admins[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teacherOptions: TypeaheadOption[] = teachers.map((t) => ({ id: t.id, label: t.name }));

  function onClassChange(next: string) {
    setClassId(next);
    if (!teacherTouched) {
      const classTeacherId = classes.find((c) => c.id === next)?.class_teacher_id;
      setTeacherIds(classTeacherId ? [classTeacherId] : []);
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
          teacherIds,
          adminId,
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
  if (admins.length === 0) {
    return (
      <p className="rounded-sm border border-amber-300 bg-amber-50 p-4 text-base text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200">
        Create a staff account with the &ldquo;Front office&rdquo; role first — PTMs need one assigned to
        approve bookings.
      </p>
    );
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
        <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
          <span className="font-medium text-maroon">Teachers</span>
          <TypeaheadPicker
            options={teacherOptions}
            selected={teacherIds}
            onChange={(next) => {
              setTeacherTouched(true);
              setTeacherIds(next);
            }}
            placeholder="Add a teacher…"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Front office (approves bookings)</span>
          <ComboBox
            options={admins.map((a) => ({ value: a.id, label: a.name }))}
            value={adminId}
            onChange={setAdminId}
            required
            placeholder="Search staff…"
            ariaLabel="Front office"
            recallKey="ptm-admin"
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
      </div>
      <Button
        onClick={submit}
        loading={isPending}
        disabled={!classId || !date || teacherIds.length === 0 || !adminId}
        icon={<PlusIcon className="h-5 w-5" />}
        className="mt-4 px-5 py-2.5"
      >
        Create PTM
      </Button>
      {error && <p className="mt-3 text-base text-rose-700">{error}</p>}
    </div>
  );
}
