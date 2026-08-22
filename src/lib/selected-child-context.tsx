"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "manthan:selectedChildId";

/** The minimal shape of a student needed to drive the global child switcher. */
export type SelectedChildStudent = { id: string; first_name: string; last_name: string };

type SelectedChildContextValue = {
  selectedChildId: string | undefined;
  setSelectedChildId: (id: string) => void;
  students: SelectedChildStudent[];
};

const SelectedChildContext = createContext<SelectedChildContextValue | null>(null);

/**
 * Holds the guardian's currently-selected child across the whole parent portal,
 * persisted to localStorage so it survives navigation between pages. Mounted once
 * in the parent layout, above every page that used to keep its own `ChildTabs` +
 * `useState`.
 *
 * Like `ThemeToggle`/`PushToggle`, the initial render must match the server (no
 * `localStorage` access during SSR), so state starts at `students[0]?.id` and is
 * only reconciled with the stored value after mount, in an effect.
 */
export function SelectedChildProvider({
  students,
  children,
}: {
  /** The guardian's full student list, used to validate/default the selection. */
  students: SelectedChildStudent[];
  children: ReactNode;
}) {
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(students[0]?.id);

  // Reconcile with localStorage after mount — a stale id (e.g. from before a
  // child was removed) falls back to the first student.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}
    const valid = stored && students.some((s) => s.id === stored);
    // Restoring the persisted selection after mount is the whole point here —
    // matches ThemeToggle's same localStorage-after-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedChildId(valid ? stored! : students[0]?.id);
    // Only run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    try {
      localStorage.setItem(STORAGE_KEY, selectedChildId);
    } catch {}
  }, [selectedChildId]);

  return (
    <SelectedChildContext.Provider value={{ selectedChildId, setSelectedChildId, students }}>
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
