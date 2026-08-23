import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MeetingSlotManager } from "@/components/meeting-slot-manager";
import { ChevronLeftIcon } from "@/components/icons";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

export default async function PtmMeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const { meetingId } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("ptm_meetings")
    .select("*, class_sections(grade, section)")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) notFound();

  const [{ data: slots }, { data: meetingTeachers }] = await Promise.all([
    supabase.from("ptm_slots").select("*").eq("meeting_id", meetingId),
    supabase.from("ptm_meeting_teachers").select("teacher_id, staff(name)").eq("meeting_id", meetingId),
  ]);
  const teacherNames = (meetingTeachers ?? [])
    .map((t) => (t.staff as unknown as { name: string } | null)?.name)
    .filter((n): n is string => !!n);
  const { data: assignedAdmin } = meeting.assigned_admin_id
    ? await supabase.from("staff").select("name").eq("id", meeting.assigned_admin_id).maybeSingle()
    : { data: null };

  // Names for booked slots.
  const studentIds = [...new Set((slots ?? []).map((s) => s.booked_student_id).filter((id): id is string => !!id))];
  const guardianIds = [...new Set((slots ?? []).map((s) => s.booked_by_guardian_id).filter((id): id is string => !!id))];
  const [{ data: students }, { data: guardians }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id, first_name, last_name").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    guardianIds.length
      ? supabase.from("guardians").select("id, name").in("id", guardianIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));

  const slotIds = (slots ?? []).map((s) => s.id);
  const { data: approvalStepRows } = slotIds.length
    ? await supabase
        .from("approval_steps")
        .select("*")
        .eq("subject_type", "ptm_slot_request")
        .in("subject_id", slotIds)
    : { data: [] as Tables<"approval_steps">[] };

  const approvalSteps: Record<string, Tables<"approval_steps">[]> = {};
  for (const step of approvalStepRows ?? []) {
    (approvalSteps[step.subject_id] ??= []).push(step);
  }

  const cls = meeting.class_sections as { grade: string; section: string } | null;
  const classLabel = cls ? `Grade ${cls.grade}-${cls.section}` : "Class";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/console/ptm"
          className="inline-flex items-center gap-1 text-sm text-rust hover:underline"
        >
          <ChevronLeftIcon className="h-4 w-4" /> All PTMs
        </Link>
        <h1 className="mt-2 font-heading text-4xl text-maroon text-balance">{classLabel}</h1>
        <p className="mt-2 text-lg text-slate-strong">
          {meeting.title ?? "Parent–teacher meeting"} · {formatDate(meeting.meeting_date)}
        </p>
        <p className="mt-1 text-sm text-slate">
          Front office: {assignedAdmin?.name ?? "Unassigned"}
          {teacherNames.length > 0 && ` · Teachers: ${teacherNames.join(", ")}`}
        </p>
      </div>

      <MeetingSlotManager
        meetingId={meeting.id}
        status={meeting.status}
        windowStart={meeting.window_start}
        windowEnd={meeting.window_end}
        slotMinutes={meeting.slot_minutes}
        slots={slots ?? []}
        studentNames={studentNames}
        guardianNames={guardianNames}
        approvalSteps={approvalSteps}
        viewerStaffId={viewer.staff.id}
        viewerRole={viewer.staff.role}
        assignedAdminId={meeting.assigned_admin_id}
      />
    </div>
  );
}
