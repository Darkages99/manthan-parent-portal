import { redirect } from "next/navigation";
import { MessagePermissionsGrid } from "@/components/message-permissions-grid";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function MessagePermissionsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const { data: permissions } = await supabase
    .from("message_send_permissions")
    .select("role, scope_type, allowed");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Message permissions</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Control which staff roles may send messages at each scope. Unchecking a box blocks that
          role from sending at that scope immediately.
        </p>
      </div>

      <MessagePermissionsGrid permissions={permissions ?? []} />
    </div>
  );
}
