import { redirect } from "next/navigation";
import Link from "next/link";
import { ConsoleAlerts } from "@/components/console-alerts";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { ExpandableList } from "@/components/expandable-list";
import { getConsoleAlerts } from "@/lib/console-alerts";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
import { MailIcon } from "@/components/icons";

export default async function StaffDashboard() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const isAdmin = isPrincipalRole(viewer.staff.role);

  const [alerts, staffAlerts, { data: dtrEvents }] = await Promise.all([
    getConsoleAlerts(viewer.staff),
    isAdmin
      ? supabase
          .from("staff_reassignment_alerts")
          .select("id, message")
          .eq("resolved", false)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; message: string }[] }),
    supabase
      .from("dtr_events")
      .select("id, title, category, event_date, description")
      .order("event_date", { ascending: true }),
  ]);

  // Pending counts come straight from the (already scoped) alert data — no need
  // for separate count queries.
  const tiles = [
    {
      href: "/console/stay-back",
      value: alerts.pendingStayBack.length,
      label: "Stay-back requests awaiting a decision",
    },
    {
      href: "/console/leave",
      value: alerts.pendingLeave.length,
      label: "Leave requests awaiting a decision",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Overview</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Dashboard</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Left column: pending-approval tiles + compose CTA. */}
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {tiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-sm border p-5 shadow-[var(--shadow-card)] transition hover:border-rust/60 ${
                  t.value > 0 ? "border-rust/40 bg-rust-tint/30" : "border-hairline bg-surface"
                }`}
              >
                <p className="font-heading text-4xl text-maroon">{t.value}</p>
                <p className="mt-1 text-base text-slate-strong">{t.label}</p>
              </Link>
            ))}
          </div>
          <Link
            href="/console/messages"
            className="flex items-center gap-3 rounded-sm border border-hairline bg-maroon p-5 text-cream shadow-[var(--shadow-card)] transition hover:bg-maroon-strong"
          >
            <MailIcon className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-heading text-2xl">Compose message →</p>
              <p className="mt-1 text-base text-cream/80">Send a circular to a class, student or group</p>
            </div>
          </Link>
        </div>

        {/* Right column: the alert hub. */}
        <ConsoleAlerts data={alerts} staffAlerts={staffAlerts.data ?? []} />
      </div>

      {/* Today at a glance — on leave, homework due, staying back. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TodayCard title="On leave today" emptyLabel="Nobody on approved leave today.">
          {alerts.onLeaveToday.map((s) => (
            <li key={s.id} className="rounded-sm border border-hairline bg-mist/40 px-4 py-2.5 text-base">
              <span className="font-semibold text-maroon">{s.name}</span>
              {s.className && <span className="text-slate"> · {s.className}</span>}
              <span className="block text-sm text-slate-strong">{s.reason}</span>
            </li>
          ))}
        </TodayCard>

        <TodayCard title="Homework due today" emptyLabel="No outstanding homework due today.">
          {alerts.dueHomeworkToday.map((s) => (
            <li key={s.id} className="rounded-sm border border-hairline bg-mist/40 px-4 py-2.5 text-base">
              <span className="font-semibold text-maroon">{s.name}</span>
              {s.className && <span className="text-slate"> · {s.className}</span>}
              <span className="block text-sm text-slate-strong">
                {s.count} item{s.count === 1 ? "" : "s"} not done
              </span>
            </li>
          ))}
        </TodayCard>

        <TodayCard title="Staying back today" emptyLabel="Nobody staying back today.">
          {alerts.stayingBackToday.map((s) => (
            <li key={s.id} className="rounded-sm border border-hairline bg-mist/40 px-4 py-2.5 text-base">
              <span className="font-semibold text-maroon">{s.name}</span>
              {s.className && <span className="text-slate"> · {s.className}</span>}
              <span className="block text-sm text-slate-strong">
                {formatTime(s.fromTime)}–{formatTime(s.toTime)}
              </span>
            </li>
          ))}
        </TodayCard>
      </div>

      {/* School calendar — visible to staff, not just parents. */}
      <DashboardCalendar events={dtrEvents ?? []} fullHref="/console/calendar" />
    </div>
  );
}

function TodayCard({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode[];
}) {
  const isEmpty = !children || children.length === 0;
  return (
    <section className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 font-heading text-xl text-maroon">
        {title}
        {!isEmpty && <span className="ml-2 text-base font-normal text-slate">· {children.length}</span>}
      </h2>
      {isEmpty ? (
        <p className="text-base text-slate">{emptyLabel}</p>
      ) : (
        <ExpandableList initialCount={5} className="flex flex-col gap-2">
          {children}
        </ExpandableList>
      )}
    </section>
  );
}
