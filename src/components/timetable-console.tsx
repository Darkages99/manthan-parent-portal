"use client";

import { useMemo, useState, useTransition } from "react";
import { TimetableGrid, type GridCell } from "./timetable-grid";
import { upsertEntry } from "@/app/(staff)/console/timetable/actions";
import {
  DAYS,
  cellKey,
  collidingCellsForClass,
  detectCollisions,
  formatPeriodTime,
  sortPeriods,
  type Period,
  type TimetableEntry,
} from "@/lib/timetable";
import type { Tables } from "@/lib/supabase/database.types";

type ClassLite = Pick<Tables<"class_sections">, "id" | "grade" | "section">;
type Named = { id: string; name: string };

export function TimetableConsole({
  canEdit,
  periods,
  classes,
  subjects,
  teachers,
  initialEntries,
  myStaffId,
}: {
  canEdit: boolean;
  periods: Period[];
  classes: ClassLite[];
  subjects: Named[];
  teachers: Named[];
  initialEntries: TimetableEntry[];
  myStaffId: string;
}) {
  const [entries, setEntries] = useState<TimetableEntry[]>(initialEntries);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [tab, setTab] = useState<"mine" | "class">("mine");

  const classLabel = useMemo(() => {
    const m = new Map(classes.map((c) => [c.id, `Grade ${c.grade}-${c.section}`]));
    return (id: string) => m.get(id) ?? "Class";
  }, [classes]);
  const subjectName = useMemo(() => {
    const m = new Map(subjects.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "" : "");
  }, [subjects]);
  const teacherName = useMemo(() => {
    const m = new Map(teachers.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "" : "");
  }, [teachers]);

  const collisions = useMemo(() => detectCollisions(entries, periods), [entries, periods]);

  if (classes.length === 0) {
    return <p className="text-base text-slate">No classes have been set up yet.</p>;
  }

  // ---- Principal: collision panel + per-class builder --------------------
  if (canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <CollisionPanel
          collisions={collisions}
          periods={periods}
          classLabel={classLabel}
          teacherName={teacherName}
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-strong" htmlFor="tt-class">
            Editing timetable for
          </label>
          <select
            id="tt-class"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Grade {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </div>

        <BuilderGrid
          classSectionId={selectedClassId}
          periods={periods}
          entries={entries}
          setEntries={setEntries}
          subjects={subjects}
          teachers={teachers}
          conflictCells={collidingCellsForClass(collisions, selectedClassId)}
        />
      </div>
    );
  }

  // ---- Teacher / other staff: read-only my-schedule + class view ---------
  const myCells: Record<string, GridCell> = {};
  for (const e of entries) {
    if (e.teacher_id !== myStaffId) continue;
    myCells[cellKey(e.day_of_week, e.period_id)] = {
      primary: subjectName(e.subject_id) || "Class",
      secondary: classLabel(e.class_section_id),
    };
  }

  const classCells: Record<string, GridCell> = {};
  for (const e of entries) {
    if (e.class_section_id !== selectedClassId) continue;
    classCells[cellKey(e.day_of_week, e.period_id)] = {
      primary: subjectName(e.subject_id) || "—",
      secondary: teacherName(e.teacher_id),
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My schedule
        </TabButton>
        <TabButton active={tab === "class"} onClick={() => setTab("class")}>
          Class timetables
        </TabButton>
      </div>

      {tab === "mine" ? (
        <TimetableGrid
          periods={periods}
          cells={myCells}
          emptyLabel="You have no periods assigned yet."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full max-w-xs rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Grade {c.grade}-{c.section}
              </option>
            ))}
          </select>
          <TimetableGrid periods={periods} cells={classCells} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-base font-medium transition ${
        active
          ? "bg-rust text-white"
          : "border border-hairline bg-mist text-slate-strong hover:bg-parchment"
      }`}
    >
      {children}
    </button>
  );
}

/** Lists every teacher double-booked in the same day+period across two classes. */
function CollisionPanel({
  collisions,
  periods,
  classLabel,
  teacherName,
}: {
  collisions: ReturnType<typeof detectCollisions>;
  periods: Period[];
  classLabel: (id: string) => string;
  teacherName: (id: string | null) => string;
}) {
  const periodById = useMemo(() => new Map(periods.map((p) => [p.id, p])), [periods]);

  if (collisions.length === 0) {
    return (
      <div className="rounded-sm border border-emerald-300 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200">
        No clashes — every teacher is in at most one class per period.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-rose-400 bg-rose-50/70 p-4 dark:border-rose-500/50 dark:bg-rose-900/20">
      <h2 className="font-heading text-lg text-rose-700 dark:text-rose-200">
        {collisions.length} {collisions.length === 1 ? "clash" : "clashes"} to resolve
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {collisions.map((c, i) => {
          const p = periodById.get(c.periodId);
          const day = DAYS.find((d) => d.n === c.day)?.full ?? "";
          return (
            <li key={i} className="text-sm text-slate-strong">
              <span className="font-semibold text-maroon">{teacherName(c.teacherId)}</span> is booked
              in {c.classSectionIds.map(classLabel).join(" & ")} on {day}
              {p ? ` · ${p.label} (${formatPeriodTime(p)})` : ""}.
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The editable grid for one class. Each teaching cell has a subject + teacher
 *  select; changing either upserts the cell and updates shared entry state so
 *  collisions recompute live. */
function BuilderGrid({
  classSectionId,
  periods,
  entries,
  setEntries,
  subjects,
  teachers,
  conflictCells,
}: {
  classSectionId: string;
  periods: Period[];
  entries: TimetableEntry[];
  setEntries: React.Dispatch<React.SetStateAction<TimetableEntry[]>>;
  subjects: Named[];
  teachers: Named[];
  conflictCells: Set<string>;
}) {
  const ordered = sortPeriods(periods);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byCell = useMemo(() => {
    const m = new Map<string, TimetableEntry>();
    for (const e of entries) {
      if (e.class_section_id === classSectionId) m.set(cellKey(e.day_of_week, e.period_id), e);
    }
    return m;
  }, [entries, classSectionId]);

  function change(day: number, periodId: string, subjectId: string | null, teacherId: string | null) {
    const key = `${classSectionId}:${cellKey(day, periodId)}`;
    setSavingKey(key);
    setError(null);
    startTransition(async () => {
      try {
        const saved = await upsertEntry({
          classSectionId,
          dayOfWeek: day,
          periodId,
          subjectId,
          teacherId,
        });
        setEntries((prev) => {
          const rest = prev.filter(
            (e) =>
              !(
                e.class_section_id === classSectionId &&
                e.day_of_week === day &&
                e.period_id === periodId
              )
          );
          return saved ? [...rest, saved] : rest;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead className="bg-maroon text-cream">
            <tr>
              <th className="px-3 py-3 font-heading text-sm font-normal">Time</th>
              {DAYS.map((d) => (
                <th key={d.n} className="px-3 py-3 text-center font-heading text-sm font-normal">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {ordered.map((p) =>
              p.is_break ? (
                <tr key={p.id} className="bg-mist/60">
                  <td className="px-3 py-2 text-xs tabular-nums text-slate">{formatPeriodTime(p)}</td>
                  <td
                    colSpan={DAYS.length}
                    className="px-3 py-2 text-center text-sm font-medium uppercase tracking-wide text-slate"
                  >
                    {p.label}
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <p className="text-sm font-semibold text-slate-strong">{p.label}</p>
                    <p className="text-xs tabular-nums text-slate">{formatPeriodTime(p)}</p>
                  </td>
                  {DAYS.map((d) => {
                    const k = cellKey(d.n, p.id);
                    const entry = byCell.get(k);
                    const cellKeyFull = `${classSectionId}:${k}`;
                    const conflict = conflictCells.has(k);
                    return (
                      <td key={d.n} className="px-1.5 py-1.5 align-top">
                        <div
                          className={`flex flex-col gap-1 rounded-sm border p-1 ${
                            conflict
                              ? "border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-900/20"
                              : "border-transparent"
                          }`}
                        >
                          <select
                            value={entry?.subject_id ?? ""}
                            disabled={savingKey === cellKeyFull}
                            onChange={(e) =>
                              change(d.n, p.id, e.target.value || null, entry?.teacher_id ?? null)
                            }
                            className="w-full rounded-sm border border-hairline bg-mist px-1.5 py-1 text-xs text-slate-strong"
                            aria-label="Subject"
                          >
                            <option value="">— Subject —</option>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={entry?.teacher_id ?? ""}
                            disabled={savingKey === cellKeyFull}
                            onChange={(e) =>
                              change(d.n, p.id, entry?.subject_id ?? null, e.target.value || null)
                            }
                            className={`w-full rounded-sm border px-1.5 py-1 text-xs ${
                              conflict
                                ? "border-rose-400 bg-white text-rose-700 dark:bg-transparent"
                                : "border-hairline bg-mist text-slate-strong"
                            }`}
                            aria-label="Teacher"
                          >
                            <option value="">— Teacher —</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate">
        Pick a subject and teacher for each period. Clashes — a teacher booked in two classes at once
        — are outlined in red here and listed above. Clear a cell by setting both back to blank.
      </p>
    </div>
  );
}
