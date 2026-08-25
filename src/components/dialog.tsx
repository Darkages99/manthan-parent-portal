"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloseIcon } from "./icons";
import { EASE_OUT_EXPO } from "@/lib/motion";

/**
 * A generic modal popup — backdrop + centered panel, closes on backdrop
 * click or Escape. Used to open forms (Create PTM, Compose message, ...) in
 * a popup instead of always rendering them inline on the page.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-toast)] flex items-start justify-center overflow-y-auto p-4 py-10 sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-xl rounded-md border border-hairline bg-surface shadow-[var(--shadow-pop)]"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
              <h2 className="font-heading text-lg text-maroon">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-sm p-1.5 text-slate hover:bg-mist hover:text-maroon"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
