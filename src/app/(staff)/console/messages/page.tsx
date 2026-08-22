import { redirect } from "next/navigation";
import Link from "next/link";
import { ComposeForm } from "@/components/compose-form";
import { SentMessagesList } from "@/components/sent-messages-list";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();
  const [{ data: classSections }, { data: students }, { data: groups }, { data: messages }] =
    await Promise.all([
      supabase.from("class_sections").select("*").order("grade", { ascending: true }),
      supabase
        .from("students")
        .select("id, first_name, last_name, class_section_id")
        .order("first_name"),
      supabase.from("custom_groups").select("id, name").order("name"),
      supabase
        .from("messages")
        .select("*, staff(name), message_attachments(*), message_targets(*)")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false }),
    ]);

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    label: `${s.first_name} ${s.last_name}`,
    classSectionId: s.class_section_id,
  }));

  const classNames = Object.fromEntries(
    (classSections ?? []).map((c) => [c.id, `Grade ${c.grade}-${c.section}`])
  );
  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const groupNames = Object.fromEntries((groups ?? []).map((g) => [g.id, g.name]));

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
        {isPrincipalRole(viewer.staff.role) && (
          <Link
            href="/console/messages/permissions"
            className="shrink-0 rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist"
          >
            Send permissions
          </Link>
        )}
      </div>

      <ComposeForm
        classSections={classSections ?? []}
        students={studentOptions}
        groups={groups ?? []}
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
