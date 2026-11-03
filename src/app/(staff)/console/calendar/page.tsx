import { redirect } from "next/navigation";
import { CalendarManager } from "@/components/calendar-manager";
import { getViewer } from "@/lib/session";
import { isLeadershipRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleCalendar() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const isLeadership = isLeadershipRole(viewer.staff.role);
  const taughtClassIds = isLeadership ? null : new Set(await getTaughtClassIds(supabase, viewer.staff.id));

  const [
    { data: events },
    { data: eventClasses },
    { data: eventGroups },
    { data: allClassSections },
    { data: allGroups },
    { data: groupAccess },
  ] = await Promise.all([
    supabase.from("dtr_events").select("*").order("event_date", { ascending: true }),
    supabase.from("dtr_event_classes").select("*"),
    supabase.from("dtr_event_groups").select("*"),
    supabase.from("class_sections").select("*").order("grade").order("section"),
    supabase.from("custom_groups").select("id, name, created_by").order("name"),
    supabase.from("custom_group_staff_access").select("custom_group_id").eq("staff_id", viewer.staff.id),
  ]);

  // Teachers pick from their own classes and the groups they made or were given;
  // create_dtr_event() enforces the same rule on the server.
  const classSections = taughtClassIds
    ? (allClassSections ?? []).filter((c) => taughtClassIds.has(c.id))
    : (allClassSections ?? []);
  const grantedGroupIds = new Set((groupAccess ?? []).map((a) => a.custom_group_id));
  const groups = isLeadership
    ? (allGroups ?? [])
    : (allGroups ?? []).filter((g) => g.created_by === viewer.staff.id || grantedGroupIds.has(g.id));

  // "Who it's for" label per event: class and group names, or whole school.
  const classNames = new Map((allClassSections ?? []).map((c) => [c.id, `${c.grade}${c.section}`]));
  const groupNames = new Map((allGroups ?? []).map((g) => [g.id, g.name]));
  const targets = new Map<string, string[]>();
  for (const ec of eventClasses ?? []) {
    targets.set(ec.dtr_event_id, [...(targets.get(ec.dtr_event_id) ?? []), classNames.get(ec.class_section_id) ?? "a class"]);
  }
  for (const eg of eventGroups ?? []) {
    targets.set(eg.dtr_event_id, [...(targets.get(eg.dtr_event_id) ?? []), groupNames.get(eg.custom_group_id) ?? "a group"]);
  }
  const audienceById = Object.fromEntries(
    (events ?? []).map((e) => [e.id, targets.get(e.id)?.join(", ") ?? "Whole school"])
  );

  // Mirrors RLS on dtr_events: the creator and leadership may edit or delete.
  const editableIds = (events ?? [])
    .filter((e) => isLeadership || e.created_by === viewer.staff.id)
    .map((e) => e.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">School calendar</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Dates to Remember</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Exams, holidays, events and deadlines across the school.{" "}
          {isLeadership
            ? "Add dates for the whole school or for chosen classes and groups."
            : "Add dates for the classes you teach or your groups."}
        </p>
      </div>

      <CalendarManager
        events={events ?? []}
        audienceById={audienceById}
        editableIds={editableIds}
        classSections={classSections}
        groups={groups}
        canAddSchoolWide={isLeadership}
      />
    </div>
  );
}
