import { redirect } from "next/navigation";
import Link from "next/link";
import { CustomGroupManager } from "@/components/custom-group-manager";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function MessageGroupsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console/messages");

  const supabase = await createClient();
  const [
    { data: groups },
    { data: memberRows },
    { data: students },
    { data: teachers },
    { data: accessRows },
  ] = await Promise.all([
    supabase.from("custom_groups").select("id, name").order("name"),
    supabase.from("custom_group_students").select("custom_group_id, student_id"),
    supabase.from("students").select("id, first_name, last_name").order("first_name"),
    supabase.from("staff").select("id, name").eq("role", "class_teacher").order("name"),
    supabase.from("custom_group_staff_access").select("custom_group_id, staff_id"),
  ]);

  const members: Record<string, string[]> = {};
  for (const r of memberRows ?? []) {
    (members[r.custom_group_id] ??= []).push(r.student_id);
  }
  const access: Record<string, string[]> = {};
  for (const r of accessRows ?? []) {
    (access[r.custom_group_id] ??= []).push(r.staff_id);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/console/messages" className="text-sm font-medium text-rust hover:underline">
          ← Messages
        </Link>
        <p className="mt-2 font-heading text-sm uppercase tracking-[0.18em] text-rust">Messaging</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Custom groups</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Create reusable recipient groups, manage who&apos;s in them, and decide which teachers can send
          to each one.
        </p>
      </div>

      <CustomGroupManager
        groups={groups ?? []}
        members={members}
        students={(students ?? []).map((s) => ({ id: s.id, label: `${s.first_name} ${s.last_name}` }))}
        teachers={(teachers ?? []).map((t) => ({ id: t.id, label: t.name }))}
        access={access}
      />
    </div>
  );
}
