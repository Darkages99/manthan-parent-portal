import { redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { LeaveForm } from "@/components/leave-form";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const { from, to } = await searchParams;

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);
  let leavesQuery = supabase
    .from("leave_requests")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  // Overlap: the request's [from_date, to_date] span intersects the requested range.
  if (from) leavesQuery = leavesQuery.gte("to_date", from);
  if (to) leavesQuery = leavesQuery.lte("from_date", to);
  const { data: leaves } = await leavesQuery;

  const exportQuery = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();

  const studentById = (id: string) => viewer.students.find((s) => s.id === id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Attendance</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Leave permission</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Request leave for a child and track approval from the class teacher.
        </p>
      </div>

      <LeaveForm students={viewer.students} />

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">From</span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">To</span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
          />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-maroon px-4 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong"
        >
          Filter
        </button>
        <a
          href={`/api/export/leave${exportQuery ? `?${exportQuery}` : ""}`}
          className="rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
        >
          Download CSV
        </a>
      </form>

      <ul className="flex flex-col gap-3">
        {(leaves ?? []).map((l) => {
          const student = studentById(l.student_id);
          return (
            <li key={l.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-maroon">
                    {student?.first_name} — {l.reason}
                  </p>
                  <p className="mt-1 text-base text-slate-strong">
                    {formatDate(l.from_date)} → {formatDate(l.to_date)}
                  </p>
                </div>
                <StatusPill status={l.status} />
              </div>
            </li>
          );
        })}
        {(!leaves || leaves.length === 0) && <p className="text-base text-slate">No leave requests yet.</p>}
      </ul>
    </div>
  );
}
