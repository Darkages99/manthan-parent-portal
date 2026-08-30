import { redirect } from "next/navigation";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardAlerts } from "@/components/dashboard-alerts";
import { NotificationsInbox, type Notification } from "@/components/notifications-inbox";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { reportCardSignature, type DashboardAlertData } from "@/lib/alerts";

export default async function ParentHome() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");
  const { guardian, students } = viewer;

  const supabase = await createClient();
  const studentIds = students.map((s) => s.id);
  const classIdList = Array.from(
    new Set(students.map((s) => s.classSection?.id).filter((id): id is string => !!id))
  );
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [
    { data: events },
    { data: eventClasses },
    { data: stayBacks },
    { data: leaveRequests },
    { data: messages },
    { data: ptmSlots },
    { data: examResults },
    { data: receipts },
    { data: groupMemberships },
  ] = await Promise.all([
    supabase.from("dtr_events").select("*").order("event_date", { ascending: true }),
    supabase.from("dtr_event_classes").select("*"),
    supabase
      .from("stay_back_consents")
      .select("id")
      .in("student_id", studentIds)
      .eq("status", "pending"),
    supabase
      .from("leave_requests")
      .select("id")
      .in("student_id", studentIds)
      .eq("status", "pending")
      .gte("to_date", today),
    supabase
      .from("messages")
      .select("id, subject, body, sent_at, urgent, scope_type, staff(name), message_targets(student_id, class_section_id, custom_group_id)")
      .order("sent_at", { ascending: false })
      .limit(12),
    supabase
      .from("ptm_slots")
      .select("class_section_id, booked_by_guardian_id, booked_student_id")
      .in("class_section_id", classIdList.length ? classIdList : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("exam_results")
      .select("student_id, report_card_pdf_url")
      .in("student_id", studentIds),
    supabase
      .from("message_receipts")
      .select("message_id")
      .eq("guardian_id", guardian.id)
      .is("read_at", null),
    supabase.from("custom_group_students").select("student_id, custom_group_id").in("student_id", studentIds),
  ]);

  // Keep only events that target one of this guardian's classes (or all classes).
  const classIds = new Set(students.map((s) => s.classSection?.id).filter(Boolean));
  const scopedEventIds = new Set((eventClasses ?? []).map((ec) => ec.dtr_event_id));
  const visibleEvents = (events ?? []).filter(
    (e) =>
      !scopedEventIds.has(e.id) ||
      (eventClasses ?? []).some((ec) => ec.dtr_event_id === e.id && classIds.has(ec.class_section_id))
  );

  const unreadMessageIds = new Set((receipts ?? []).map((r) => r.message_id));

  // For multi-child guardians: work out which of their children each message
  // actually reaches, so the inbox can flag messages that aren't for everyone
  // (e.g. a class circular that only applies to one of the guardian's kids).
  const groupIdsByStudent = new Map<string, Set<string>>();
  for (const g of groupMemberships ?? []) {
    if (!groupIdsByStudent.has(g.student_id)) groupIdsByStudent.set(g.student_id, new Set());
    groupIdsByStudent.get(g.student_id)!.add(g.custom_group_id);
  }

  const notifications: Notification[] = (messages ?? []).map((m) => {
    let onlyForChildren: string[] | null = null;
    if (students.length > 1 && m.scope_type !== "school") {
      const targets = m.message_targets ?? [];
      const matched = students.filter((s) =>
        targets.some(
          (t) =>
            t.student_id === s.id ||
            (t.class_section_id && t.class_section_id === s.classSection?.id) ||
            (t.custom_group_id && groupIdsByStudent.get(s.id)?.has(t.custom_group_id))
        )
      );
      if (matched.length > 0 && matched.length < students.length) {
        onlyForChildren = matched.map((s) => s.first_name);
      }
    }
    return {
      id: m.id,
      subject: m.subject,
      body: m.body,
      sent_at: m.sent_at,
      urgent: m.urgent,
      senderName: m.staff?.name ?? null,
      unread: unreadMessageIds.has(m.id),
      onlyForChildren,
    };
  });

  // Actionable alerts: fees (placeholder), PTM bookings still needed, and newly
  // published report cards. PTM/report-card items clear themselves once the
  // parent acts (books a slot / opens Results). See src/lib/alerts.ts.
  const alertData: DashboardAlertData = {
    feeDue: true, // TODO(fees): derive from outstanding invoices once payments ship.
    pendingLeaveCount: leaveRequests?.length ?? 0,
    pendingStayBackCount: stayBacks?.length ?? 0,
    students: students.map((s) => {
      const classId = s.classSection?.id;
      const classSlots = (ptmSlots ?? []).filter((sl) => sl.class_section_id === classId);
      const hasOpenSlot = classSlots.some((sl) => !sl.booked_by_guardian_id);
      const hasBooking = (ptmSlots ?? []).some((sl) => sl.booked_student_id === s.id);
      const signature = reportCardSignature(
        (examResults ?? [])
          .filter((r) => r.student_id === s.id)
          .map((r) => r.report_card_pdf_url)
      );
      return {
        id: s.id,
        name: s.first_name,
        ptmNeedsBooking: hasOpenSlot && !hasBooking,
        reportCardAvailable: signature.length > 0,
        reportCardSignature: signature,
      };
    }),
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Dashboard</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">
          Namaste, {guardian.name.split(" ")[0]}
        </h1>
      </div>

      {/* Week strip + alerts on the left, school notifications inbox on the right. */}
      <section className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-6">
          <DashboardCalendar events={visibleEvents} />
          <DashboardAlerts data={alertData} />
        </div>
        <NotificationsInbox notifications={notifications} />
      </section>
    </div>
  );
}
