"use client";

import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/motion";

/** Shared building blocks for route `loading.tsx` fallbacks — shaped like the
 * content they stand in for (cards, table rows, list rows) rather than
 * generic bars, with a staggered fade-in so the page doesn't just "pop". */

export function SkeletonHeader({ withSubtitle = false }: { withSubtitle?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-3 w-24 animate-pulse rounded-sm bg-hairline" />
      <div className="h-9 w-64 animate-pulse rounded-sm bg-hairline" />
      {withSubtitle && <div className="h-5 w-full max-w-prose animate-pulse rounded-sm bg-hairline" />}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="show"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={fadeUp} className="h-28 animate-pulse rounded-sm border border-hairline bg-mist" />
      ))}
    </motion.div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <motion.div
      variants={staggerContainer(0.04)}
      initial="hidden"
      animate="show"
      className="overflow-hidden rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]"
    >
      <div className="h-11 animate-pulse bg-mist" />
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div key={i} variants={fadeUp} className="flex items-center gap-4 px-5 py-4">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-hairline" />
            <div className="h-4 w-24 animate-pulse rounded-sm bg-hairline" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded-sm bg-hairline" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="show" className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div key={i} variants={fadeUp} className="h-24 animate-pulse rounded-sm border border-hairline bg-mist" />
      ))}
    </motion.div>
  );
}
