import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MeetingSlotManager } from "@/components/meeting-slot-manager";
import { ChevronLeftIcon } from "@/components/icons";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

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

  const { data: slots } = await supabase
    .from("ptm_slots")
    .select("*")
    .eq("meeting_id", meetingId);

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
      </div>

      <MeetingSlotManager
        meetingId={meeting.id}
        status={meeting.status}
        slots={slots ?? []}
        studentNames={studentNames}
        guardianNames={guardianNames}
      />
    </div>
  );
}
