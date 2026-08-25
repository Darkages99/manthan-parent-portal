"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, CloseIcon } from "./icons";

export type ComboOption = {
  value: string;
  label: string;
  /** Short context shown next to the label, e.g. a class code ("10A"). */
  sublabel?: string;
};

const RECALL_PREFIX = "combobox:recent:";

function readRecent(recallKey?: string): string | null {
  if (!recallKey || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(RECALL_PREFIX + recallKey);
  } catch {
    return null;
  }
}

function writeRecent(recallKey: string | undefined, value: string) {
  if (!recallKey || typeof window === "undefined" || !value) return;
  try {
    window.localStorage.setItem(RECALL_PREFIX + recallKey, value);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Single-select type-ahead dropdown — a drop-in replacement for long
 * `<select>` lists. Shows the current value; typing narrows the options in a
 * dropdown. When `recallKey` is set, the most recently chosen value is
 * remembered (localStorage), pinned to the top of the list, and — if
 * `defaultToRecent` is set and no value is selected yet — pre-filled on mount.
 *
 * Pass `name` to emit a hidden input so the value posts with a plain <form>.
 */
export function ComboBox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel,
  disabled,
  name,
  required,
  recallKey,
  defaultToRecent = false,
  maxResults = 50,
  className,
  ariaLabel,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional first row that clears the selection (e.g. "— Unassigned —"). */
  emptyLabel?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  recallKey?: string;
  defaultToRecent?: boolean;
  maxResults?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const optionByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );
  const selected = value ? optionByValue.get(value) : undefined;

  // Pre-fill from the most recently used value when asked and nothing is set.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (defaultToRecent && !value) {
      const recent = readRecent(recallKey);
      if (recent && optionByValue.has(recent)) onChange(recent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = options.filter(
      (o) =>
        !q ||
        o.label.toLowerCase().includes(q) ||
        o.sublabel?.toLowerCase().includes(q),
    );
    if (!q) {
      // Surface the most-recent value first when the list is unfiltered.
      const recent = readRecent(recallKey);
      if (recent) {
        matched.sort((a, b) => (b.value === recent ? 1 : 0) - (a.value === recent ? 1 : 0));
      }
    }
    return matched.slice(0, maxResults);
  }, [options, query, recallKey, maxResults]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(next: string) {
    onChange(next);
    if (next) writeRecent(recallKey, next);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    setHighlight(0);
  }

  const rows: (ComboOption | null)[] = emptyLabel ? [null, ...results] : results;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        const row = rows[highlight];
        choose(row ? row.value : "");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const boxCls =
    className ??
    "w-full rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong";

  return (
    <div ref={rootRef} className="relative">
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <div className={`flex items-center gap-2 ${boxCls} ${disabled ? "opacity-60" : ""}`}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selected?.label ?? ""}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={openList}
          onClick={openList}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate"
        />
        {selected && !required && !open && (
          <button
            type="button"
            aria-label="Clear"
            disabled={disabled}
            onClick={() => choose("")}
            className="text-slate hover:text-rose-600"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate" />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-hairline bg-surface py-1 shadow-[var(--shadow-card)]"
        >
          {rows.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate">No matches</li>
          )}
          {rows.map((row, i) => {
            const isEmpty = row === null;
            const rowValue = isEmpty ? "" : row.value;
            const active = i === highlight;
            const isSelected = rowValue === value;
            return (
              <li key={isEmpty ? "__empty__" : row.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(rowValue)}
                  className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-base ${
                    active ? "bg-mist" : ""
                  } ${isSelected ? "font-medium text-maroon" : "text-slate-strong"}`}
                >
                  <span className={isEmpty ? "text-slate" : ""}>
                    {isEmpty ? emptyLabel : row.label}
                  </span>
                  {!isEmpty && row.sublabel && (
                    <span className="text-sm text-slate">{row.sublabel}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
