import { redirect } from "next/navigation";
import Link from "next/link";
import { CreatePtmForm } from "@/components/create-ptm-form";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon } from "@/components/icons";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function StaffPtm() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const [{ data: allClasses }, { data: staff }] = await Promise.all([
    supabase.from("class_sections").select("*").order("grade"),
    supabase.from("staff").select("id, name").eq("role", "class_teacher").order("name"),
  ]);
  const classes =
    viewer.staff.role === "class_teacher"
      ? (allClasses ?? []).filter((c) => c.class_teacher_id === viewer.staff.id)
      : (allClasses ?? []);
  const classIds = classes.map((c) => c.id);

  let meetingsQuery = supabase
    .from("ptm_meetings")
    .select("*")
    .order("meeting_date", { ascending: false });
  if (viewer.staff.role === "class_teacher") {
    meetingsQuery = meetingsQuery.eq("teacher_id", viewer.staff.id);
  }
  const [{ data: meetings }, { data: slots }] = await Promise.all([
    meetingsQuery,
    supabase.from("ptm_slots").select("meeting_id, booked_by_guardian_id"),
  ]);

  const classLabel = (id: string) => {
    const c = classes.find((cs) => cs.id === id);
    return c ? `Grade ${c.grade}-${c.section}` : "Class";
  };
  const slotStats = new Map<string, { total: number; booked: number }>();
  for (const s of slots ?? []) {
    const stat = slotStats.get(s.meeting_id) ?? { total: 0, booked: 0 };
    stat.total += 1;
    if (s.booked_by_guardian_id) stat.booked += 1;
    slotStats.set(s.meeting_id, stat);
  }

  const visibleMeetings = (meetings ?? []).filter(
    (m) => classIds.length === 0 || classIds.includes(m.class_section_id)
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Meetings</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">PTMs</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Create a parent–teacher meeting for a class, then open time slots for parents to book.
        </p>
      </div>

      <CreatePtmForm classes={classes} staff={staff ?? []} />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Your PTMs</h2>
        {visibleMeetings.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No PTMs yet"
            detail="Create one above to start opening booking slots for a class."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMeetings.map((m) => {
              const stat = slotStats.get(m.id) ?? { total: 0, booked: 0 };
              return (
                <li key={m.id}>
                  <Link
                    href={`/console/ptm/${m.id}`}
                    className="flex h-full flex-col gap-2 rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] transition hover:border-rust/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-heading text-lg text-maroon">
                        {classLabel(m.class_section_id)}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          m.status === "open"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
                        }`}
                      >
                        {m.status === "open" ? "Open" : "Closed"}
                      </span>
                    </div>
                    <p className="text-base text-slate-strong">{m.title ?? "Parent–teacher meeting"}</p>
                    <p className="text-sm text-slate">{formatDate(m.meeting_date)}</p>
                    <p className="mt-auto pt-2 text-sm text-slate-strong">
                      {stat.total === 0
                        ? "No slots opened yet"
                        : `${stat.booked}/${stat.total} slots booked`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
