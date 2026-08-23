import "server-only";
import type { createClient } from "./supabase/server";
import type { Tables } from "./supabase/database.types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// A GET with `.in("student_id", [...])` puts every id in the URL. With hundreds
// of students that URL blows past the platform's size limit and the request
// fails — which, if the error is ignored, silently reads back as zero rows and
// makes saved attendance look like it vanished on refresh. So only inline the
// filter for short lists (a class teacher's class); for large scopes (a
// principal seeing the whole school) filter by date alone — bounded to one row
// per enrolled student — and narrow to the requested students in memory.
const MAX_IN_LIST = 300;

/**
 * Today's (or any single date's) attendance rows, scoped to `studentIds`,
 * fetched without ever building an oversized query URL. Throws on a real query
 * error rather than swallowing it into an empty result.
 */
export async function fetchAttendanceForDate(
  supabase: ServerClient,
  date: string,
  studentIds: string[]
): Promise<Tables<"attendance_records">[]> {
  if (studentIds.length === 0) return [];

  let query = supabase.from("attendance_records").select("*").eq("date", date);
  if (studentIds.length <= MAX_IN_LIST) query = query.in("student_id", studentIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  if (studentIds.length <= MAX_IN_LIST) return data ?? [];
  const ids = new Set(studentIds);
  return (data ?? []).filter((r) => ids.has(r.student_id));
}
