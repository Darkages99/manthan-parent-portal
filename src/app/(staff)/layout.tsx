import { redirect } from "next/navigation";
import { StaffShell, type PtmNavMeeting, type ClassNavItem } from "@/components/staff-shell";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { shouldRemindAttendance } from "@/lib/attendance-reminder";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer) redirect("/");
  if (viewer.type === "guardian") redirect("/home");

  const attendanceReminder = await shouldRemindAttendance(viewer.staff);

  // PTM meetings shown as collapsible sub-items under the PTMs nav entry.
  // Class teachers see meetings they're named on; front office staff see ones
  // assigned to them; principal-tier roles see all.
  const supabase = await createClient();
  let meetingIds: string[] | null = null;
  if (viewer.staff.role === "class_teacher") {
    const { data: links } = await supabase
      .from("ptm_meeting_teachers")
      .select("meeting_id")
      .eq("teacher_id", viewer.staff.id);
    meetingIds = [...new Set((links ?? []).map((l) => l.meeting_id))];
  } else if (viewer.staff.role === "front_office") {
    const { data: assigned } = await supabase
      .from("ptm_meetings")
      .select("id")
      .eq("assigned_admin_id", viewer.staff.id);
    meetingIds = (assigned ?? []).map((m) => m.id);
  }

  let meetingsQuery = supabase
    .from("ptm_meetings")
    .select("id, meeting_date, class_sections(grade, section)")
    .order("meeting_date", { ascending: false })
    .limit(20);
  if (meetingIds !== null) {
    meetingsQuery = meetingsQuery.in(
      "id",
      meetingIds.length ? meetingIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }
  const { data: meetings } = await meetingsQuery;

  const ptmMeetings: PtmNavMeeting[] = (meetings ?? []).map((m) => {
    const cls = m.class_sections as { grade: string; section: string } | null;
    const when = new Date(m.meeting_date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
    const where = cls ? `Grade ${cls.grade}-${cls.section}` : "Class";
    return { id: m.id, label: `${where} · ${when}` };
  });

  let classes: ClassNavItem[] = [];
  if (isPrincipalRole(viewer.staff.role)) {
    const { data: classSections } = await supabase
      .from("class_sections")
      .select("id, grade, section")
      .order("grade")
      .order("section");
    classes = (classSections ?? []).map((c) => ({ id: c.id, label: `Grade ${c.grade}-${c.section}` }));
  }

  return (
    <StaffShell
      staffName={viewer.staff.name}
      role={viewer.staff.role}
      ptmMeetings={ptmMeetings}
      attendanceReminder={attendanceReminder}
      classes={classes}
    >
      {children}
    </StaffShell>
  );
}
