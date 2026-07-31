import type { Enums } from "@/lib/supabase/database.types";

export type DTRCategory = Enums<"dtr_category">;

export const DTR_CATEGORIES: DTRCategory[] = [
  "exam",
  "holiday",
  "event",
  "deadline",
  "ptm",
  "other",
];

export const categoryLabel: Record<DTRCategory, string> = {
  exam: "Exam",
  holiday: "Holiday",
  event: "Event",
  deadline: "Deadline",
  ptm: "PTM",
  other: "Other",
};

/** Pill / chip styling (text + tinted background) per category. */
export const categoryChip: Record<DTRCategory, string> = {
  exam: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  holiday: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  event: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  deadline: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  ptm: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  other: "bg-parchment text-slate-strong",
};

/** Solid dot color per category, for the compact monthly calendar view. */
export const categoryDot: Record<DTRCategory, string> = {
  exam: "bg-rose-500",
  holiday: "bg-emerald-500",
  event: "bg-sky-500",
  deadline: "bg-amber-500",
  ptm: "bg-violet-500",
  other: "bg-slate-400",
};
