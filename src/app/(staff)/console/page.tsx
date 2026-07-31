import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const TODAY = new Date().toISOString().slice(0, 10);

export default async function StaffDashboard() {
  const supabase = await createClient();

  const [stayBack, leave, ptmBooked, attendanceToday] = await Promise.all([
    supabase.from("stay_back_consents").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("ptm_slots").select("*", { count: "exact", head: true }).not("booked_by_guardian_id", "is", null),
    supabase.from("attendance_records").select("*", { count: "exact", head: true }).eq("date", TODAY),
  ]);

  const tiles = [
    { href: "/console/stay-back", value: stayBack.count ?? 0, label: "Stay-back requests awaiting a decision", accent: true },
    { href: "/console/leave", value: leave.count ?? 0, label: "Leave requests awaiting a decision", accent: true },
    { href: "/console/attendance", value: attendanceToday.count ?? 0, label: "Attendance rows marked today" },
    { href: "/console/ptm", value: ptmBooked.count ?? 0, label: "PTM slots booked" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Overview</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-sm border p-5 shadow-[var(--shadow-card)] transition hover:border-rust/60 ${
              t.accent && t.value > 0 ? "border-rust/40 bg-rust-tint/30" : "border-hairline bg-surface"
            }`}
          >
            <p className="font-heading text-4xl text-maroon">{t.value}</p>
            <p className="mt-1 text-base text-slate-strong">{t.label}</p>
          </Link>
        ))}
        <Link
          href="/console/messages/compose"
          className="flex flex-col justify-center rounded-sm border border-hairline bg-maroon p-5 text-cream shadow-[var(--shadow-card)] transition hover:bg-maroon-strong"
        >
          <p className="font-heading text-2xl">Compose message →</p>
          <p className="mt-1 text-base text-cream/80">Send a circular to a class, student or group</p>
        </Link>
      </div>
    </div>
  );
}
