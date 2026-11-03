import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";
import { categoryLabel, type DTRCategory } from "@/lib/dtr";
import { formatDayDate } from "@/lib/format";

/** Ids per `.in()` lookup; ~800 student uuids in one query string is too long a URL (see push.ts). */
const ID_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Today's date in IST as YYYY-MM-DD. */
function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Pushes a new calendar event to the guardians it is for: everyone when it has
 * no classes and no groups (whole school), otherwise guardians of students in
 * a targeted class or group. Same audience the parent calendar shows (see
 * dtr-visibility.ts). Events dated before today are not announced, so
 * back-filling the calendar stays quiet.
 */
export async function notifyCalendarEvent(event: {
  title: string;
  eventDate: string;
  category: DTRCategory;
  classSectionIds: string[];
  groupIds: string[];
}): Promise<{ notified: number }> {
  if (event.eventDate < todayIst()) return { notified: 0 };
  const admin = createAdminClient();
  const wholeSchool = event.classSectionIds.length === 0 && event.groupIds.length === 0;

  let guardianIds: string[];
  if (wholeSchool) {
    const { data } = await admin.from("guardian_student").select("guardian_id");
    guardianIds = (data ?? []).map((l) => l.guardian_id);
  } else {
    const [{ data: inClasses }, { data: inGroups }] = await Promise.all([
      event.classSectionIds.length
        ? admin.from("students").select("id").in("class_section_id", event.classSectionIds)
        : Promise.resolve({ data: [] as { id: string }[] }),
      event.groupIds.length
        ? admin.from("custom_group_students").select("student_id").in("custom_group_id", event.groupIds)
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);
    const studentIds = [
      ...new Set([...(inClasses ?? []).map((s) => s.id), ...(inGroups ?? []).map((m) => m.student_id)]),
    ];
    const links = await Promise.all(
      chunk(studentIds, ID_CHUNK).map(async (ids) => {
        const { data } = await admin.from("guardian_student").select("guardian_id").in("student_id", ids);
        return data ?? [];
      })
    );
    guardianIds = links.flat().map((l) => l.guardian_id);
  }

  const recipients = [...new Set(guardianIds)];
  if (recipients.length === 0) return { notified: 0 };

  await sendPush(
    recipients.map((userId) => ({ userId, role: "guardian" as const })),
    {
      title: event.title,
      body: `${categoryLabel[event.category]} on ${formatDayDate(event.eventDate)}`,
      url: "/dtr",
    },
    "calendar"
  );
  return { notified: recipients.length };
}
