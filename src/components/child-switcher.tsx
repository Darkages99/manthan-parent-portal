"use client";

import { useSelectedChild } from "@/lib/selected-child-context";
import { UsersIcon } from "./icons";

/**
 * Compact sidebar-footer control for switching the globally-selected child on
 * multi-child accounts. Unlike `ChildTabs` (a per-page pill row), this is a
 * single dropdown sized to sit in the `AppShell` footer alongside the account
 * name and sign-out link.
 */
export function ChildSwitcher() {
  const { students, selectedChildId, setSelectedChildId } = useSelectedChild();

  if (students.length < 2) return null;

  return (
    <div className="flex items-center gap-2 rounded-sm border border-hairline bg-mist px-2 py-1.5">
      <UsersIcon className="h-4 w-4 shrink-0 text-slate" aria-hidden />
      <select
        value={selectedChildId ?? students[0]?.id}
        onChange={(e) => setSelectedChildId(e.target.value)}
        aria-label="Switch child"
        className="w-full min-w-0 bg-transparent text-sm font-medium text-slate-strong outline-none"
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.first_name} {s.last_name}
          </option>
        ))}
      </select>
    </div>
  );
}
