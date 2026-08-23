import { redirect } from "next/navigation";
import Link from "next/link";
import { ComposeForm } from "@/components/compose-form";
import { SentMessagesList } from "@/components/sent-messages-list";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { getTaughtClassIds } from "@/lib/teacher-scope";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const isTeacher = viewer.staff.role === "class_teacher";
  const taughtClassIds = isTeacher ? new Set(await getTaughtClassIds(supabase, viewer.staff.id)) : null;

  const isAdmin = isPrincipalRole(viewer.staff.role);

  const [{ data: allClassSections }, { data: allStudents }, { data: allGroups }, { data: messages }, { data: groupAccess }] =
    await Promise.all([
      supabase.from("class_sections").select("*").order("grade", { ascending: true }),
      supabase
        .from("students")
        .select("id, first_name, last_name, class_section_id")
        .order("first_name"),
      supabase.from("custom_groups").select("id, name, created_by").order("name"),
      supabase
        .from("messages")
        .select("*, staff(name), message_attachments(*), message_targets(*)")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false }),
      supabase.from("custom_group_staff_access").select("custom_group_id, staff_id"),
    ]);

  // Teachers only see their own taught classes, their students, and groups
  // they created or were explicitly assigned to (or that are made up entirely
  // of their own students — mirrors the server-side check in compose/actions.ts).
  const classSections = isTeacher
    ? (allClassSections ?? []).filter((c) => taughtClassIds!.has(c.id))
    : (allClassSections ?? []);
  const students = isTeacher
    ? (allStudents ?? []).filter((s) => taughtClassIds!.has(s.class_section_id))
    : (allStudents ?? []);
  const accessibleGroupIds = new Set(
    (groupAccess ?? []).filter((a) => a.staff_id === viewer.staff.id).map((a) => a.custom_group_id)
  );
  const groups = isTeacher
    ? (allGroups ?? []).filter((g) => g.created_by === viewer.staff.id || accessibleGroupIds.has(g.id))
    : (allGroups ?? []);

  const studentOptions = students.map((s) => ({
    id: s.id,
    label: `${s.first_name} ${s.last_name}`,
    classSectionId: s.class_section_id,
  }));

  // Sent-message history can reference classes/students/groups outside the
  // viewer's current scope (e.g. a teacher reassigned since sending), so
  // label lookups use the unfiltered lists.
  const classNames = Object.fromEntries(
    (allClassSections ?? []).map((c) => [c.id, `Grade ${c.grade}-${c.section}`])
  );
  const studentNames = Object.fromEntries(
    (allStudents ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const groupNames = Object.fromEntries((allGroups ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Messaging</p>
          <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Messages</h1>
          <p className="mt-2 max-w-prose text-lg text-slate-strong">
            Send a circular to the whole school, a class, a student or a saved group — and review
            everything you&apos;ve sent.
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            <Link
              href="/console/messages/groups"
              className="rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist"
            >
              Manage custom groups
            </Link>
            <Link
              href="/console/messages/permissions"
              className="rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist"
            >
              Send permissions
            </Link>
          </div>
        )}
      </div>

      <ComposeForm
        classSections={classSections ?? []}
        students={studentOptions}
        groups={groups ?? []}
        isTeacher={isTeacher}
      />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Sent messages</h2>
        <SentMessagesList
          messages={messages ?? []}
          classNames={classNames}
          studentNames={studentNames}
          groupNames={groupNames}
        />
      </section>
    </div>
  );
}
