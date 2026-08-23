import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/** Today's date in IST as YYYY-MM-DD (matches how attendance is marked). */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** true for Sunday, computed in IST (matches istToday()). */
function isSundayIST(): boolean {
  const weekday = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  return weekday === "Sun";
}

/**
 * Whether the signed-in staff member should be nudged to mark today's
 * attendance: only for class teachers with an assigned class, skipping
 * Sundays and any day registered as a holiday in the DTR calendar, and only
 * while at least one of their students has no attendance record yet today.
 */
export async function shouldRemindAttendance(staff: Tables<"staff">): Promise<boolean> {
  if (staff.role !== "class_teacher") return false;
  if (isSundayIST()) return false;

  const supabase = await createClient();
  const today = istToday();

  const { data: classes } = await supabase
    .from("class_sections")
    .select("id")
    .eq("class_teacher_id", staff.id);
  const classIds = (classes ?? []).map((c) => c.id);
  if (classIds.length === 0) return false;

  // Holidays and the class roster are independent lookups — fetch together.
  const [{ data: holidays }, { data: students }] = await Promise.all([
    supabase
      .from("dtr_events")
      .select("id, dtr_event_classes(class_section_id)")
      .eq("event_date", today)
      .eq("category", "holiday"),
    supabase.from("students").select("id").in("class_section_id", classIds),
  ]);
  const isHolidayToday = (holidays ?? []).some((h) => {
    const classRows = (h.dtr_event_classes ?? []) as { class_section_id: string | null }[];
    // No linked classes = whole-school holiday; otherwise only for the linked classes.
    return classRows.length === 0 || classRows.some((r) => r.class_section_id && classIds.includes(r.class_section_id));
  });
  if (isHolidayToday) return false;

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return false;

  const { data: records } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("date", today)
    .in("student_id", studentIds);

  const markedCount = new Set((records ?? []).map((r) => r.student_id)).size;
  return markedCount < studentIds.length;
}
