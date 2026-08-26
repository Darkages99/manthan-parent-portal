"use client";

import { motion } from "framer-motion";
import { PlusIcon } from "./icons";

/**
 * The one sticky "create" affordance: a round maroon "+" pinned to the
 * bottom-right of a screen. It sits at `--z-sticky` (below `--z-toast`, so
 * dialogs and toasts cover it) and just calls `onClick` — every create surface
 * already owns a `useState(false)` dialog, so the FAB reuses the same opener.
 */
export function CreateFab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      className="fixed bottom-6 right-6 z-[var(--z-sticky)] inline-flex h-14 w-14 items-center justify-center rounded-full bg-maroon text-cream shadow-[var(--shadow-pop)] transition-colors hover:bg-maroon-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2"
    >
      <PlusIcon className="h-6 w-6" />
    </motion.button>
  );
}
