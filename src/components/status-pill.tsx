"use client";

import { AnimatePresence, motion } from "framer-motion";

const styles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  expired: "bg-slate-200 text-slate-strong dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-slate-200 text-slate-strong dark:bg-slate-800 dark:text-slate-300",
};

const labels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  scheduled: "Scheduled",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function StatusPill({
  status,
}: {
  status: "pending" | "approved" | "declined" | "expired" | "scheduled" | "cancelled";
}) {
  return (
    <span className="relative inline-grid">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={`col-start-1 row-start-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${styles[status]}`}
        >
          {labels[status]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
