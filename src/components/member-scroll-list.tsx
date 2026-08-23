"use client";

import { CloseIcon } from "./icons";

/** Scrollable list of currently-selected members (~3 rows visible before
 * scrolling) — replaces a tag/chip row when the selection can get long. */
export function MemberScrollList({
  items,
  onRemove,
  emptyLabel = "No one added yet.",
  disabled,
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  if (items.length === 0) {
    return <p className="rounded-sm border border-dashed border-hairline px-3 py-2.5 text-sm text-slate">{emptyLabel}</p>;
  }

  return (
    <ul className="max-h-[7.5rem] divide-y divide-hairline overflow-y-auto rounded-sm border border-hairline bg-mist/40">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="truncate text-base text-slate-strong">{item.label}</span>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.label}`}
            disabled={disabled}
            className="shrink-0 text-slate hover:text-rose-600 disabled:opacity-60"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
