"use client";

import { useMemo, useState } from "react";
import {
  fromISODate,
  monthGrid,
  monthLabel,
  weekOf,
  weekRangeLabel,
  toISODate,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import {
  DTR_CATEGORIES,
  categoryChip,
  categoryDot,
  categoryLabel,
  type DTRCategory,
} from "@/lib/dtr";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type Event = Tables<"dtr_events">;
type View = "month" | "week";
/** "day" shows the selected day's events; "list" shows every date for the active tag. */
type PanelMode = "day" | "list";

export function DtrFilterView({ events }: { events: Event[] }) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<View>("month");
  const [active, setActive] = useState<DTRCategory | "all">("all");
  const [panelMode, setPanelMode] = useState<PanelMode>("day");
  // Anchor date for the currently shown month/week.
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(toISODate(today));

  const filtered = useMemo(
    () => events.filter((e) => active === "all" || e.category === active),
    [events, active]
  );

  function selectCategory(c: DTRCategory | "all") {
    setActive(c);
    setPanelMode(c === "all" ? "day" : "list");
  }

  function selectDay(iso: string) {
    setSelected(iso);
    setPanelMode("day");
  }

  function jumpToEvent(e: Event) {
    setAnchor(fromISODate(e.event_date));
    setSelected(e.event_date);
    setPanelMode("day");
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of filtered) {
      map.set(e.event_date, [...(map.get(e.event_date) ?? []), e]);
    }
    return map;
  }, [filtered]);

  function step(delta: number) {
    setAnchor((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  const weeks = useMemo(
    () => monthGrid(anchor.getFullYear(), anchor.getMonth(), today),
    [anchor, today]
  );
  const weekDays = useMemo(() => weekOf(anchor, today), [anchor, today]);
  const selectedEvents = eventsByDay.get(selected) ?? [];

  const categories: (DTRCategory | "all")[] = ["all", ...DTR_CATEGORIES];

  return (
    <div className="flex flex-col gap-5">
      {/* View switch + navigation. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-hairline bg-mist p-0.5">
          {(["month", "week"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                view === v ? "bg-maroon text-cream shadow-sm" : "text-slate-strong hover:text-maroon"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={view === "month" ? "Previous month" : "Previous week"}
            className="rounded-sm p-1.5 text-slate-strong transition hover:bg-mist hover:text-maroon"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="min-w-[11rem] text-center font-heading text-lg text-maroon">
            {view === "month"
              ? monthLabel(anchor.getFullYear(), anchor.getMonth())
              : weekRangeLabel(weekDays)}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={view === "month" ? "Next month" : "Next week"}
            className="rounded-sm p-1.5 text-slate-strong transition hover:bg-mist hover:text-maroon"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchor(today);
              setSelected(toISODate(today));
              setPanelMode("day");
            }}
            className="ml-1 rounded-full px-3 py-1 text-sm font-medium text-rust transition hover:bg-mist"
          >
            Today
          </button>
        </div>
      </div>

      {/* Category filter chips. */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => selectCategory(c)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
              active === c
                ? "border-rust bg-rust text-white"
                : "border-hairline bg-mist text-slate-strong hover:border-rust/60"
            }`}
          >
            {c !== "all" && (
              <span
                className={`h-2 w-2 rounded-full ${active === c ? "bg-white" : categoryDot[c]}`}
              />
            )}
            {c === "all" ? "All" : categoryLabel[c]}
          </button>
        ))}
      </div>

      {view === "month" ? (
        <MonthView
          weeks={weeks}
          eventsByDay={eventsByDay}
          selected={selected}
          onSelect={selectDay}
          selectedEvents={selectedEvents}
          activeCategory={active}
          categoryEvents={filtered}
          onJumpToEvent={jumpToEvent}
          panelMode={panelMode}
        />
      ) : (
        <WeekView weekDays={weekDays} eventsByDay={eventsByDay} />
      )}
    </div>
  );
}

/** Compact month grid — coloured dots (tags) only — with a details panel beside it. */
function MonthView({
  weeks,
  eventsByDay,
  selected,
  onSelect,
  selectedEvents,
  activeCategory,
  categoryEvents,
  onJumpToEvent,
  panelMode,
}: {
  weeks: ReturnType<typeof monthGrid>;
  eventsByDay: Map<string, Event[]>;
  selected: string;
  onSelect: (iso: string) => void;
  selectedEvents: Event[];
  activeCategory: DTRCategory | "all";
  categoryEvents: Event[];
  onJumpToEvent: (event: Event) => void;
  panelMode: "day" | "list";
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[26rem_1fr]">
      <div className="mx-auto w-full max-w-md rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] md:mx-0">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate">
              {d}
            </div>
          ))}
          {weeks.flat().map((day) => {
            const dayEvents = eventsByDay.get(day.iso) ?? [];
            const isSelected = panelMode === "day" && day.iso === selected;
            // Distinct categories present that day → one dot each.
            const cats = [...new Set(dayEvents.map((e) => e.category))];
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => onSelect(day.iso)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-sm transition ${
                  isSelected
                    ? "bg-maroon text-cream"
                    : day.inMonth
                      ? "text-slate-strong hover:bg-mist"
                      : "text-slate/40 hover:bg-mist"
                } ${day.isToday && !isSelected ? "ring-1 ring-rust" : ""}`}
              >
                <span className={`text-2xl leading-none ${day.isToday ? "font-bold" : "font-medium"}`}>
                  {day.date.getDate()}
                </span>
                {cats.length > 0 && (
                  <span className="flex flex-wrap items-center justify-center gap-1">
                    {cats.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className={`h-2 w-2 rounded-full ${isSelected ? "bg-cream" : categoryDot[c]}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Details panel: the selected day, or every date for the active tag. */}
      <div>
        {panelMode === "day" ? (
          <>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">
              {new Date(selected).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-base text-slate">Nothing on this day.</p>
            ) : (
              <ul className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
                {selectedEvents.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">
              {activeCategory !== "all" ? categoryLabel[activeCategory] : ""} dates
            </p>
            {categoryEvents.length === 0 ? (
              <p className="text-base text-slate">
                No {activeCategory !== "all" ? categoryLabel[activeCategory].toLowerCase() : ""} dates yet.
              </p>
            ) : (
              <ul className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
                {categoryEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onJumpToEvent(e)}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-mist ${
                        e.event_date === selected ? "bg-mist" : ""
                      }`}
                    >
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${categoryDot[e.category]}`} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold uppercase tracking-wide text-rust">
                          {fromISODate(e.event_date).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="mt-0.5 text-base font-semibold text-maroon">{e.title}</p>
                        {e.description && <p className="mt-1 text-sm text-slate-strong">{e.description}</p>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Detailed week view — every day laid out with its full event descriptions. */
function WeekView({
  weekDays,
  eventsByDay,
}: {
  weekDays: ReturnType<typeof weekOf>;
  eventsByDay: Map<string, Event[]>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {weekDays.map((day) => {
        const dayEvents = eventsByDay.get(day.iso) ?? [];
        return (
          <div
            key={day.iso}
            className={`flex gap-4 rounded-sm border bg-surface p-4 shadow-[var(--shadow-card)] ${
              day.isToday ? "border-rust" : "border-hairline"
            }`}
          >
            <div className="w-14 shrink-0 text-center">
              <p className="text-xs uppercase tracking-wide text-slate">
                {day.date.toLocaleDateString("en-IN", { weekday: "short" })}
              </p>
              <p className={`font-heading text-2xl leading-tight ${day.isToday ? "text-rust" : "text-maroon"}`}>
                {day.date.getDate()}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              {dayEvents.length === 0 ? (
                <p className="py-1 text-sm text-slate/70">—</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {dayEvents.map((e) => (
                    <li key={e.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${categoryDot[e.category]}`} />
                        <p className="text-base font-semibold text-maroon">{e.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${categoryChip[e.category]}`}>
                          {categoryLabel[e.category]}
                        </span>
                      </div>
                      {e.description && (
                        <p className="mt-1 pl-5 text-base text-slate-strong">{e.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventRow({ event: e }: { event: Event }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${categoryDot[e.category]}`} />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-maroon">{e.title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${categoryChip[e.category]}`}>
            {categoryLabel[e.category]}
          </span>
        </div>
        {e.description && <p className="mt-1 text-base text-slate-strong">{e.description}</p>}
      </div>
    </li>
  );
}
