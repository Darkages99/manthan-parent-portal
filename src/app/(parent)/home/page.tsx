import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardAlerts } from "@/components/dashboard-alerts";
import { NotificationsInbox, type Notification } from "@/components/notifications-inbox";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
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

  const [
    { data: events },
    { data: eventClasses },
    { data: stayBacks },
    { data: messages },
    { data: ptmSlots },
    { data: examResults },
  ] = await Promise.all([
    supabase.from("dtr_events").select("*").order("event_date", { ascending: true }),
    supabase.from("dtr_event_classes").select("*"),
    supabase
      .from("stay_back_consents")
      .select("*")
      .in("student_id", studentIds)
      .eq("status", "pending"),
    supabase
      .from("messages")
      .select("id, subject, body, sent_at, urgent, staff(name)")
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
  ]);

  // Keep only events that target one of this guardian's classes (or all classes).
  const classIds = new Set(students.map((s) => s.classSection?.id).filter(Boolean));
  const scopedEventIds = new Set((eventClasses ?? []).map((ec) => ec.dtr_event_id));
  const visibleEvents = (events ?? []).filter(
    (e) =>
      !scopedEventIds.has(e.id) ||
      (eventClasses ?? []).some((ec) => ec.dtr_event_id === e.id && classIds.has(ec.class_section_id))
  );

  const notifications: Notification[] = (messages ?? []).map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body,
    sent_at: m.sent_at,
    urgent: m.urgent,
    senderName: m.staff?.name ?? null,
  }));

  // Actionable alerts: fees (placeholder), PTM bookings still needed, and newly
  // published report cards. PTM/report-card items clear themselves once the
  // parent acts (books a slot / opens Results). See src/lib/alerts.ts.
  const alertData: DashboardAlertData = {
    feeDue: true, // TODO(fees): derive from outstanding invoices once payments ship.
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

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Your children</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {students.map((s) => (
            <div
              key={s.id}
              className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <p className="font-heading text-xl text-maroon">
                {s.first_name} {s.last_name}
              </p>
              <p className="text-base text-slate-strong">
                {s.classSection ? `Grade ${s.classSection.grade} - ${s.classSection.section}` : "—"} · Roll No.{" "}
                {s.roll_no}
              </p>
            </div>
          ))}
        </div>
      </section>

      {stayBacks && stayBacks.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-xl text-maroon">Awaiting approval</h2>
          {stayBacks.map((c) => (
            <Link
              key={c.id}
              href="/stay-back"
              className="block rounded-sm border border-hairline bg-rust-tint/40 p-5 shadow-[var(--shadow-card)] transition hover:bg-rust-tint/60"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-maroon">Stay-back consent</p>
                  <p className="mt-1 text-base text-slate-strong">{c.reason}</p>
                  <p className="mt-1 text-sm text-slate">
                    {c.stay_date} · {formatTime(c.from_time)}–{formatTime(c.to_time)}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </div>
            </Link>
          ))}
        </section>
      )}

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
