import { redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { StayBackForm } from "@/components/stay-back-form";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";

export default async function StayBackPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const studentIds = viewer.students.map((s) => s.id);

  const [{ data: consents }, { data: teachers }] = await Promise.all([
    supabase
      .from("stay_back_consents")
      .select("*")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false }),
    supabase.from("staff").select("*").in("role", ["class_teacher", "principal"]),
  ]);

  const studentById = (id: string) => viewer.students.find((s) => s.id === id);
  const teacherById = (id: string) => (teachers ?? []).find((t) => t.id === id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approval workflow</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Stay-back consent</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Raising a request sends a push notification to the named teacher and the principal —
          both must approve it before it&apos;s confirmed.
        </p>
      </div>

      <StayBackForm students={viewer.students} teachers={teachers ?? []} />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Your requests</h2>
        <ul className="flex flex-col gap-3">
          {(consents ?? []).map((c) => {
            const student = studentById(c.student_id);
            const teacher = teacherById(c.teacher_id);
            return (
              <li key={c.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-maroon">
                      {student?.first_name} — {c.reason}
                    </p>
                    <p className="mt-1 text-base text-slate-strong">
                      {c.stay_date} · {formatTime(c.from_time)}–{formatTime(c.to_time)} · Notified{" "}
                      {teacher?.name}
                      {teacher?.role === "class_teacher" ? " + Principal" : ""}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
              </li>
            );
          })}
          {(!consents || consents.length === 0) && (
            <p className="text-base text-slate">No requests yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
