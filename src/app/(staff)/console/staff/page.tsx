import { redirect } from "next/navigation";
import { StaffManager } from "@/components/staff-manager";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ConsoleStaff() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const { data: staff } = await supabase.from("staff").select("*").order("name");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Staff</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Create staff accounts, change roles, or deactivate an account to revoke sign-in.
        </p>
      </div>

      <StaffManager staff={staff ?? []} />
    </div>
  );
}
