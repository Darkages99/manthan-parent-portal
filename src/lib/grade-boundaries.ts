import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type GradeBand = { grade: string; minPct: number; maxPct: number };

export type SubjectGradingConfig = {
  maxMarks: number;
  bands: GradeBand[];
};

/** Highest-`minPct` band whose range contains `pct`, or null if none match —
 *  bands are teacher-defined and may have gaps, so "no match" is expected,
 *  not an error. */
export function gradeForPercentage(pct: number, bands: GradeBand[]): string | null {
  const match = bands
    .filter((b) => pct >= b.minPct && pct <= b.maxPct)
    .sort((a, b) => b.minPct - a.minPct)[0];
  return match?.grade ?? null;
}

/** Reads the configured max marks (default 100 if never set) and grade bands
 *  for one subject+term. Used both to prefill the config editor and to
 *  auto-fill grade on save when a teacher enters marks without picking one. */
export async function getSubjectGradingConfig(
  supabase: SupabaseClient<Database>,
  subject: string,
  term: string
): Promise<SubjectGradingConfig> {
  const [{ data: config }, { data: boundaries }] = await Promise.all([
    supabase
      .from("subject_grading_config")
      .select("max_marks")
      .eq("subject", subject)
      .eq("term", term)
      .maybeSingle(),
    supabase
      .from("grade_boundaries")
      .select("grade, min_pct, max_pct")
      .eq("subject", subject)
      .eq("term", term)
      .order("min_pct", { ascending: false }),
  ]);

  return {
    maxMarks: config?.max_marks ?? 100,
    bands: (boundaries ?? []).map((b) => ({ grade: b.grade, minPct: b.min_pct, maxPct: b.max_pct })),
  };
}
