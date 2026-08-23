"use client";

import { useMemo, useState } from "react";
import { CloseIcon } from "./icons";

export type TypeaheadOption = { id: string; label: string };

/** Search-narrowing multi-select with removable chips — replaces long
 * checkbox lists (picking students/teachers/classes out of a few dozen
 * options) across the app. Type to narrow, click a result to add it. */
export function TypeaheadPicker({
  options,
  selected,
  onChange,
  placeholder = "Search…",
  disabled,
  maxResults = 8,
}: {
  options: TypeaheadOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxResults?: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const labelById = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selectedSet.has(o.id))
      .filter((o) => !q || o.label.toLowerCase().includes(q))
      .slice(0, maxResults);
  }, [options, query, selectedSet, maxResults]);

  function add(id: string) {
    onChange([...selected, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-mist px-2.5 py-1 text-sm text-maroon"
            >
              {labelById.get(id) ?? id}
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label="Remove"
                disabled={disabled}
                className="text-slate hover:text-rose-600 disabled:opacity-60"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          className="w-full rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong disabled:opacity-60"
        />
        {open && results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
            {results.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(o.id)}
                  className="block w-full px-3 py-2 text-left text-base text-slate-strong hover:bg-mist"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() && results.length === 0 && (
          <p className="absolute z-10 mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-slate shadow-[var(--shadow-card)]">
            No matches
          </p>
        )}
      </div>
    </div>
  );
}
