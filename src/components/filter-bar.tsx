"use client";

import { motion } from "framer-motion";
import { SearchIcon, CloseIcon } from "./icons";

/**
 * Sleek, glance-able filter controls that replace the "bare input floating on
 * top of a list" pattern. `SearchInput` is a rounded field with a leading icon
 * and a clear button; `SegmentedControl` is a pill switcher with an animated
 * active background (à la Linear) and optional per-option counts. `Toolbar`
 * lays them out on one line that wraps on small screens.
 */

export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex-1 min-w-[12rem] max-w-sm ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full rounded-full border border-hairline bg-surface py-2.5 pl-9 pr-9 text-sm text-slate-strong shadow-[var(--shadow-card)] transition-colors placeholder:text-slate focus:border-rust/60"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate hover:bg-mist hover:text-maroon"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-full border border-hairline bg-mist p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`relative z-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active ? "text-cream" : "text-slate-strong hover:text-maroon"
            }`}
          >
            {active && (
              <motion.span
                layoutId="segmented-active"
                className="absolute inset-0 -z-10 rounded-full bg-maroon"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`tabular-nums text-xs font-semibold ${
                  active ? "text-cream/80" : "text-slate"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
