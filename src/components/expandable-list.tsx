"use client";

import { Children, useState } from "react";

/**
 * Shows the first `initialCount` children and a "See N more" toggle for the
 * rest. Children are the already-rendered <li> rows, so this works with any
 * server-rendered list — the caller supplies the <ul> classes.
 */
export function ExpandableList({
  children,
  initialCount = 2,
  className = "",
  moreLabel = "See",
}: {
  children: React.ReactNode;
  initialCount?: number;
  className?: string;
  /** Verb before the hidden count, e.g. "See 5 more". */
  moreLabel?: string;
}) {
  const items = Children.toArray(children);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - initialCount;

  return (
    <div className="flex flex-col gap-3">
      <ul className={className}>{shown}</ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm font-semibold text-rust hover:underline"
        >
          {expanded ? "See less" : `${moreLabel} ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
