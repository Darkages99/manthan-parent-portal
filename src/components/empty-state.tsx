"use client";

import { motion } from "framer-motion";

type IconProps = { className?: string };

/** Centered icon + heading + subtext block for "nothing here yet" states,
 * consistent with the dashboard alerts' "all caught up" panel. */
export function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: (props: IconProps) => React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-2 rounded-sm border border-hairline bg-surface py-10 text-center shadow-[var(--shadow-card)]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mist text-slate-strong">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-base font-medium text-slate-strong">{title}</p>
      <p className="max-w-xs text-sm text-slate">{detail}</p>
    </motion.div>
  );
}
