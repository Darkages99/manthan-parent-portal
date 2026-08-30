import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { GuardianMessagesList } from "@/components/guardian-messages-list";
import { MarkMessagesRead } from "./mark-read";

/** Builds a PostgREST `.or()` clause from the non-empty target sets, or null
 * when the guardian has no classes/students/groups to match on. */
function targetOrFilter(studentIds: string[], classIds: string[], groupIds: string[]): string | null {
  const clauses: string[] = [];
  if (studentIds.length) clauses.push(`student_id.in.(${studentIds.join(",")})`);
  if (classIds.length) clauses.push(`class_section_id.in.(${classIds.join(",")})`);
  if (groupIds.length) clauses.push(`custom_group_id.in.(${groupIds.join(",")})`);
  return clauses.length ? clauses.join(",") : null;
}

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();

  // Resolve what this guardian may see: their children, those children's
  // classes, and any custom groups the children belong to. RLS enforces the
  // same scoping at the database — this query mirrors it so the page is correct
  // even if a policy is ever misconfigured, and so we never over-fetch.
  const studentIds = viewer.students.map((s) => s.id);
  const classIds = [
    ...new Set(viewer.students.map((s) => s.classSection?.id).filter((id): id is string => !!id)),
  ];

  let groupIds: string[] = [];
  if (studentIds.length) {
    const { data: groupRows } = await supabase
      .from("custom_group_students")
      .select("custom_group_id")
      .in("student_id", studentIds);
    groupIds = [...new Set((groupRows ?? []).map((g) => g.custom_group_id))];
  }

  // Message ids targeted specifically at this guardian's students/classes/groups.
  let targetedIds: string[] = [];
  const orFilter = targetOrFilter(studentIds, classIds, groupIds);
  if (orFilter) {
    const { data: targetRows } = await supabase
      .from("message_targets")
      .select("message_id")
      .or(orFilter);
    targetedIds = [...new Set((targetRows ?? []).map((t) => t.message_id))];
  }

  // Whole-school messages OR the targeted ones — and only ones actually sent.
  const scopeClauses = ["scope_type.eq.school"];
  if (targetedIds.length) scopeClauses.push(`id.in.(${targetedIds.join(",")})`);

  const { data: messages } = await supabase
    .from("messages")
    .select("*, message_attachments(*), staff(name)")
    .or(scopeClauses.join(","))
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <MarkMessagesRead />
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Inbox</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Messages</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Circulars and updates from the school, targeted to your child&apos;s class or you specifically.
        </p>
      </div>

      <GuardianMessagesList messages={messages ?? []} />
    </div>
  );
}
