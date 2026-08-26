"use client";

import { useState, useTransition } from "react";
import { addPeriod, updatePeriod, deletePeriod } from "@/app/(staff)/console/timetable/actions";
import { sortPeriods, type Period } from "@/lib/timetable";
import { ChevronDownIcon } from "./icons";

/** Trims "HH:MM:SS" (as stored) down to "HH:MM" for <input type="time">. */
function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function PeriodEditor({ periods }: { periods: Period[] }) {
  const [open, setOpen] = useState(false);
  const ordered = sortPeriods(periods);

  return (
    <div className="rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <div>
          <h2 className="font-heading text-xl text-maroon">Period structure</h2>
          <p className="text-sm text-slate">
            {ordered.length} slots · applies to every class, Mon–Sat
          </p>
        </div>
        <ChevronDownIcon className={`h-5 w-5 text-slate transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="border-t border-hairline px-5 py-4">
          <PeriodEditorBody periods={ordered} />
        </div>
      )}
    </div>
  );
}

/** The editable period rows + "add slot" control, without the collapsing card
 * chrome — used inside the timetable's "Period structure" dialog. */
export function PeriodEditorBody({ periods }: { periods: Period[] }) {
  const ordered = sortPeriods(periods);
  return (
    <div>
      <ul className="flex flex-col gap-2">
        {ordered.map((p) => (
          <PeriodRow key={p.id} period={p} />
        ))}
      </ul>
      <AddPeriodRow />
    </div>
  );
}

function PeriodRow({ period }: { period: Period }) {
  const [label, setLabel] = useState(period.label);
  const [start, setStart] = useState(hhmm(period.start_time));
  const [end, setEnd] = useState(hhmm(period.end_time));
  const [isBreak, setIsBreak] = useState(period.is_break);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty =
    label !== period.label ||
    start !== hhmm(period.start_time) ||
    end !== hhmm(period.end_time) ||
    isBreak !== period.is_break;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePeriod({ id: period.id, label, startTime: start, endTime: end, isBreak });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!confirm(`Remove "${period.label}"? Any cells in this slot are cleared.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePeriod(period.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-sm border border-hairline bg-mist/30 px-3 py-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-32 rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        aria-label="Period label"
      />
      <input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        aria-label="Start time"
      />
      <span className="text-slate">–</span>
      <input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        aria-label="End time"
      />
      <label className="flex items-center gap-1.5 text-sm text-slate-strong">
        <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
        Break
      </label>
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-sm bg-rust px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
      >
        Remove
      </button>
      {error && <span className="w-full text-sm text-rose-600">{error}</span>}
    </li>
  );
}

function AddPeriodRow() {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        await addPeriod({ label, startTime: start, endTime: end, isBreak });
        setLabel("");
        setStart("");
        setEnd("");
        setIsBreak(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="New slot label"
        className="w-32 rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        aria-label="New period label"
      />
      <input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        aria-label="New start time"
      />
      <span className="text-slate">–</span>
      <input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong"
        aria-label="New end time"
      />
      <label className="flex items-center gap-1.5 text-sm text-slate-strong">
        <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
        Break
      </label>
      <button
        type="button"
        onClick={add}
        disabled={pending || !label || !start || !end}
        className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
      >
        Add slot
      </button>
      {error && <span className="w-full text-sm text-rose-600">{error}</span>}
    </div>
  );
}
