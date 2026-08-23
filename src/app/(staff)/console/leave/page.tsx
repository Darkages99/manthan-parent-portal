import { redirect } from "next/navigation";
import { LeaveApprovalList } from "@/components/leave-approval-list";
import { StatusPill } from "@/components/status-pill";
import { ExportCsvButton } from "@/components/export-csv-button";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

/** Today's date in IST as YYYY-MM-DD. */
function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function LeaveApprovals() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const today = istToday();

  // A class teacher only sees requests for their own class's students; the principal sees all.
  const { data: allStudents } = await supabase.from("students").select("id, first_name, last_name, class_section_id");
  let visibleStudents = allStudents ?? [];
  if (viewer.staff.role === "class_teacher") {
    const { data: ownClasses } = await supabase
      .from("class_sections")
      .select("id")
      .eq("class_teacher_id", viewer.staff.id);
    const ownClassIds = new Set((ownClasses ?? []).map((c) => c.id));
    visibleStudents = visibleStudents.filter((s) => s.class_section_id && ownClassIds.has(s.class_section_id));
  }
  const visibleStudentIds = new Set(visibleStudents.map((s) => s.id));

  let leavesQuery = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
  if (viewer.staff.role === "class_teacher") {
    leavesQuery = leavesQuery.in(
      "student_id",
      visibleStudentIds.size ? [...visibleStudentIds] : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const [{ data: leaves }, { data: guardians }] = await Promise.all([
    leavesQuery,
    supabase.from("guardians").select("id, name"),
  ]);

  const studentNames = Object.fromEntries(
    visibleStudents.map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));

  const all = leaves ?? [];
  const pending = all.filter((l) => l.status === "pending");
  const decided = all.filter((l) => l.status !== "pending");
  const onLeaveToday = all.filter(
    (l) => l.status === "approved" && l.from_date <= today && l.to_date >= today
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approvals</p>
          <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Leave requests</h1>
          <p className="mt-2 max-w-prose text-lg text-slate-strong">
            Requests raised by parents. Approving or declining notifies the family.
          </p>
        </div>
        <ExportCsvButton href="/api/export/leave" />
      </div>

      {/* 1. Action zone — pending requests. */}
      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">
          Awaiting decision{pending.length > 0 && ` · ${pending.length}`}
        </h2>
        <LeaveApprovalList
          leaves={pending}
          studentNames={studentNames}
          guardianNames={guardianNames}
          emptyLabel="Nothing awaiting a decision."
        />
      </section>

      {/* 2. On leave today. */}
      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">On leave today</h2>
        {onLeaveToday.length === 0 ? (
          <p className="text-base text-slate">No approved leave covers today.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {onLeaveToday.map((l) => (
              <li
                key={l.id}
                className="rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-base"
              >
                <span className="font-semibold text-maroon">
                  {studentNames[l.student_id] ?? "Student"}
                </span>
                <span className="text-slate-strong"> — {l.reason}</span>
                <span className="mt-0.5 block text-sm text-slate">
                  {formatDate(l.from_date)} → {formatDate(l.to_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Decided log. */}
      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Past requests</h2>
        {decided.length === 0 ? (
          <p className="text-base text-slate">No decided requests yet.</p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-hairline overflow-y-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
            {decided.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-maroon">
                    {studentNames[l.student_id] ?? "Student"} — {l.reason}
                  </p>
                  <p className="mt-0.5 text-sm text-slate">
                    {formatDate(l.from_date)} → {formatDate(l.to_date)} · Requested by{" "}
                    {guardianNames[l.requested_by] ?? "guardian"}
                  </p>
                </div>
                <StatusPill status={l.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
