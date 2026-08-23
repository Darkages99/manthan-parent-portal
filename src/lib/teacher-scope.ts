import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The classes a `class_teacher`-role staff member may address: the class(es)
 * they're the assigned class teacher of, plus any classes they teach a
 * subject in per the timetable (covers specialist/subject teachers who own
 * no class of their own). Used to scope messaging (see compose/actions.ts)
 * and any other "your own classes" restriction for this role.
 */
export async function getTaughtClassIds(
  supabase: SupabaseClient<Database>,
  staffId: string
): Promise<string[]> {
  const [{ data: owned }, { data: taught }] = await Promise.all([
    supabase.from("class_sections").select("id").eq("class_teacher_id", staffId),
    supabase.from("timetable_entries").select("class_section_id").eq("teacher_id", staffId),
  ]);
  const ids = new Set<string>();
  for (const c of owned ?? []) ids.add(c.id);
  for (const t of taught ?? []) ids.add(t.class_section_id);
  return [...ids];
}
