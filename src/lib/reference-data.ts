import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

/** Subjects and timetable periods rarely change (edited only from the
 * Classes/Timetable admin screens) but were being re-fetched from scratch on
 * every request across Classes, Timetable and PTM pages. Cached for 5
 * minutes and invalidated on write via revalidateTag(). Uses the admin
 * client since unstable_cache's result is shared across requests/users and
 * can't depend on the per-request cookie-scoped client — safe here since
 * both tables are non-sensitive reference data already readable by any
 * authenticated user under RLS. */
export const getSubjects = unstable_cache(
  async (): Promise<Pick<Tables<"subjects">, "id" | "name">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("subjects").select("id, name").order("name");
    return data ?? [];
  },
  ["reference-subjects"],
  { revalidate: 300, tags: ["subjects"] }
);

export const getTimetablePeriods = unstable_cache(
  async (): Promise<Tables<"timetable_periods">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("timetable_periods").select("*");
    return data ?? [];
  },
  ["reference-timetable-periods"],
  { revalidate: 300, tags: ["timetable-periods"] }
);
