"use client";

import { useMemo, useState } from "react";
import { DATE_RANGE_OPTIONS, rangeFrom, type DateRange } from "@/lib/date-range";
import { FilterIcon, ChevronDownIcon } from "./icons";
import { ExpandableText } from "./expandable-text";
import type { Tables } from "@/lib/supabase/database.types";

type Urgency = "all" | "urgent" | "not_urgent";

type Message = Tables<"messages"> & {
  staff: { name: string } | null;
  message_attachments: Tables<"message_attachments">[];
};

/** Parent inbox list with the same search + date/urgency filter UI as the
 * staff "Sent messages" log (see SentMessagesList). */
export function GuardianMessagesList({ messages }: { messages: Message[] }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange>("all");
  const [urgency, setUrgency] = useState<Urgency>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = (range !== "all" ? 1 : 0) + (urgency !== "all" ? 1 : 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = rangeFrom(range);
    return messages.filter((m) => {
      if (q && !m.subject.toLowerCase().includes(q) && !m.body.toLowerCase().includes(q)) return false;
      if (urgency === "urgent" && !m.urgent) return false;
      if (urgency === "not_urgent" && m.urgent) return false;
      if (from && (!m.sent_at || m.sent_at < from)) return false;
      return true;
    });
  }, [messages, query, range, urgency]);

  if (messages.length === 0) {
    return <p className="text-base text-slate">No messages yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages by title or content…"
          className="min-w-[200px] flex-1 rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            aria-expanded={filterOpen}
            className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-surface px-4 py-2.5 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist"
          >
            <FilterIcon className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rust px-1 text-xs font-bold text-cream">
                {activeFilterCount}
              </span>
            )}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "" : "-rotate-90"}`} />
          </button>
          {filterOpen && (
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
              <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate">Sent</p>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as DateRange)}
                className="w-full rounded-sm border border-hairline bg-mist px-2.5 py-1.5 text-sm"
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mb-1.5 mt-3 text-sm font-semibold uppercase tracking-wide text-slate">Urgency</p>
              <div className="flex flex-col gap-1">
                {(
                  [
                    { value: "all", label: "All messages" },
                    { value: "urgent", label: "Urgent only" },
                    { value: "not_urgent", label: "Not urgent" },
                  ] as { value: Urgency; label: string }[]
                ).map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm text-slate-strong">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgency === o.value}
                      onChange={() => setUrgency(o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRange("all");
                    setUrgency("all");
                  }}
                  className="mt-3 text-sm font-medium text-rust hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-base text-slate">
          {query ? `No messages match "${query}".` : "No messages match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((m) => (
            <li key={m.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-semibold text-maroon">{m.subject}</p>
                {m.urgent && (
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                    Urgent
                  </span>
                )}
              </div>
              <ExpandableText text={m.body} className="mt-1 text-base text-slate-strong" />
              <p className="mt-2 text-sm uppercase tracking-wide text-slate">
                {m.staff?.name} ·{" "}
                {m.sent_at &&
                  new Date(m.sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </p>
              {m.message_attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.message_attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-parchment px-2.5 py-1 text-sm text-maroon transition hover:border-rust/60 hover:bg-mist"
                    >
                      <span className="rounded-sm bg-maroon px-1.5 py-0.5 text-xs font-bold text-cream">
                        PDF
                      </span>
                      {a.file_name}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
