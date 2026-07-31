"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { weekOf, weekRangeLabel, toISODate, WEEKDAY_LABELS } from "@/lib/calendar";
import { categoryChip, categoryDot, categoryLabel, type DTRCategory } from "@/lib/dtr";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type Event = {
  id: string;
  title: string;
  category: DTRCategory;
  event_date: string;
  description: string | null;
};

/** Compact single-week strip for the dashboard. Days stay clickable and show
 *  the same category tags used across the portal; the full month lives in DTR. */
export function DashboardCalendar({ events }: { events: Event[] }) {
  const today = useMemo(() => new Date(), []);
  // Anchor is any date within the shown week; navigation steps by ±7 days.
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(toISODate(today));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      map.set(e.event_date, [...(map.get(e.event_date) ?? []), e]);
    }
    return map;
  }, [events]);

  const weekDays = useMemo(() => weekOf(anchor, today), [anchor, today]);
  const selectedEvents = eventsByDay.get(selected) ?? [];

  function step(delta: number) {
    setAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl text-maroon">This week</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous week"
            className="rounded-sm p-1.5 text-slate-strong transition hover:bg-mist hover:text-maroon"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-medium text-slate-strong">
            {weekRangeLabel(weekDays)}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next week"
            className="rounded-sm p-1.5 text-slate-strong transition hover:bg-mist hover:text-maroon"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchor(today);
              setSelected(toISODate(today));
            }}
            className="ml-1 rounded-full px-3 py-1 text-sm font-medium text-rust transition hover:bg-mist"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate">
            {d}
          </div>
        ))}
        {weekDays.map((day) => {
          const dayEvents = eventsByDay.get(day.iso) ?? [];
          // One dot per distinct category present that day.
          const cats = [...new Set(dayEvents.map((e) => e.category))];
          const isSelected = day.iso === selected;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => setSelected(day.iso)}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-sm p-1 transition ${
                isSelected ? "bg-maroon text-cream" : "text-slate-strong hover:bg-mist"
              } ${day.isToday && !isSelected ? "ring-1 ring-rust" : ""}`}
            >
              <span className={`text-lg ${day.isToday ? "font-bold" : ""}`}>{day.date.getDate()}</span>
              {cats.length > 0 && (
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {cats.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-cream" : categoryDot[c]}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected-day detail. */}
      <div className="mt-4 border-t border-hairline pt-4">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">
          {new Date(selected).toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        {selectedEvents.length === 0 ? (
          <p className="text-base text-slate">Nothing scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${categoryDot[e.category]}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-maroon">{e.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${categoryChip[e.category]}`}>
                      {categoryLabel[e.category]}
                    </span>
                  </div>
                  {e.description && <p className="text-sm text-slate-strong">{e.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dtr" className="mt-3 inline-block text-sm text-rust hover:underline">
          Open full calendar →
        </Link>
      </div>
    </div>
  );
}
