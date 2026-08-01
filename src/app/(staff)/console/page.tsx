import { redirect } from "next/navigation";
import Link from "next/link";
import { ConsoleAlerts } from "@/components/console-alerts";
import { getConsoleAlerts } from "@/lib/console-alerts";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { MailIcon } from "@/components/icons";

export default async function StaffDashboard() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();

  const [stayBack, leave, alerts] = await Promise.all([
    supabase.from("stay_back_consents").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    getConsoleAlerts(viewer.staff),
  ]);

  const tiles = [
    {
      href: "/console/stay-back",
      value: stayBack.count ?? 0,
      label: "Stay-back requests awaiting a decision",
    },
    {
      href: "/console/leave",
      value: leave.count ?? 0,
      label: "Leave requests awaiting a decision",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Overview</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Dashboard</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
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
        <ConsoleAlerts data={alerts} />
      </div>
    </div>
  );
}
