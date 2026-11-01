"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "manthan:selectedChildId";

/** The minimal shape of a student needed to drive the global child switcher. */
export type SelectedChildStudent = { id: string; first_name: string; last_name: string };

type SelectedChildContextValue = {
  selectedChildId: string | undefined;
  setSelectedChildId: (id: string) => void;
  students: SelectedChildStudent[];
};

const SelectedChildContext = createContext<SelectedChildContextValue | null>(null);

// localStorage is the store; `memory` keeps the choice working when storage
// throws (private mode, quota), and `listeners` re-render subscribers on a
// same-tab write, which the `storage` event doesn't cover.
let memory: string | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): string | null {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function storeSelectedChildId(id: string) {
  memory = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  for (const listener of listeners) listener();
}

/**
 * Holds the guardian's currently-selected child across the whole parent portal,
 * persisted to localStorage so it survives navigation between pages. Mounted once
 * in the parent layout, above every page that used to keep its own `ChildTabs` +
 * `useState`.
 *
 * Like `ThemeToggle`, the initial render must match the server (no `localStorage`
 * access during SSR), so the server snapshot is "nothing stored" and the stored
 * value takes over after hydration. A stale id (e.g. from before a child was
 * removed) falls back to the first student.
 */
export function SelectedChildProvider({
  students,
  children,
}: {
  /** The guardian's full student list, used to validate/default the selection. */
  students: SelectedChildStudent[];
  children: ReactNode;
}) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const selectedChildId =
    stored && students.some((s) => s.id === stored) ? stored : students[0]?.id;

  return (
    <SelectedChildContext.Provider
      value={{ selectedChildId, setSelectedChildId: storeSelectedChildId, students }}
    >
      {children}
    </SelectedChildContext.Provider>
  );
}

/** Reads the globally-selected child. Must be used within a `SelectedChildProvider`. */
export function useSelectedChild(): SelectedChildContextValue {
  const ctx = useContext(SelectedChildContext);
  if (!ctx) throw new Error("useSelectedChild must be used within a SelectedChildProvider");
  return ctx;
}
