"use client";

import { useSelectedChild } from "@/lib/selected-child-context";
import { formatDate } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

type Homework = Tables<"homework_assignments">;
type Child = { id: string; first_name: string; last_name: string; classSectionId: string | null };

/** Today's date in IST as YYYY-MM-DD (matches how due dates are stored). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Parent-facing homework tracker: shows the globally-selected child's (see
 * `ChildSwitcher` in the nav) class homework grouped by subject, soonest due
 * date first. Read-only — staff author assignments in the console. */
export function HomeworkView({
  students,
  homeworkByClass,
  subjectName,
  commentByKey,
}: {
  students: Child[];
  homeworkByClass: Record<string, Homework[]>;
  subjectName: Record<string, string>;
  commentByKey: Record<string, string>;
}) {
  const { selectedChildId } = useSelectedChild();
  const activeId = selectedChildId ?? students[0]?.id ?? "";
  const active = students.find((s) => s.id === activeId) ?? students[0];
  const items = (active?.classSectionId && homeworkByClass[active.classSectionId]) || [];
  const today = istToday();

  // Group by subject; "General" (no subject set) sorts last, everything else
  // alphabetically. Within a group, soonest due date first.
  const groups = new Map<string, Homework[]>();
  for (const h of items) {
    const label = (h.subject_id && subjectName[h.subject_id]) || "General";
    const list = groups.get(label) ?? [];
    list.push(h);
    groups.set(label, list);
  }
  const sortedGroups = [...groups.entries()]
    .sort(([a], [b]) => (a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)))
    .map(
      ([label, list]) =>
        [label, [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))] as const
    );

  return (
    <div className="flex flex-col gap-6">
      {sortedGroups.length === 0 ? (
        <p className="text-base text-slate">No homework has been assigned yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {sortedGroups.map(([subject, list]) => (
            <section key={subject}>
              <h2 className="mb-3 font-heading text-xl text-maroon">{subject}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((h) => {
                  const overdue = h.due_date < today;
                  const dueToday = h.due_date === today;
                  const comment = active ? commentByKey[`${h.id}:${active.id}`] : undefined;
                  return (
                    <li
                      key={h.id}
                      className={`flex flex-col gap-1.5 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] ${
                        overdue ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-heading text-lg text-maroon text-balance">{h.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            overdue
                              ? "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
                              : dueToday
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                          }`}
                        >
                          {overdue ? "Past due" : dueToday ? "Due today" : formatDate(h.due_date)}
                        </span>
                      </div>
                      {h.description && <p className="text-sm text-slate-strong">{h.description}</p>}
                      {comment && (
                        <p className="rounded-sm border border-rust/30 bg-rust-tint/20 px-2.5 py-1.5 text-sm text-slate-strong">
                          <span className="font-semibold text-rust">Teacher&apos;s note:</span> {comment}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
