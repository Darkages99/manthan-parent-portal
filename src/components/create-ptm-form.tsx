"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/app/(staff)/console/ptm/actions";
import { PlusIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;

/** Creates a PTM meeting for a class + date, then jumps to its slot page. */
export function CreatePtmForm({ classes }: { classes: ClassSection[] }) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await createMeeting({ classSectionId: classId, meetingDate: date, title });
        router.push(`/console/ptm/${id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (classes.length === 0) {
    return <p className="text-base text-slate">No class is assigned to you.</p>;
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-xl text-maroon">Create a PTM</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
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
        <button
          onClick={submit}
          disabled={isPending || !classId || !date}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          <PlusIcon className="h-5 w-5" />
          {isPending ? "Creating…" : "Create PTM"}
        </button>
      </div>
      {error && <p className="mt-3 text-base text-rose-700">{error}</p>}
    </div>
  );
}
