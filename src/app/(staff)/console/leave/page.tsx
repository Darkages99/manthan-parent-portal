import { LeaveApprovalList } from "@/components/leave-approval-list";
import { createClient } from "@/lib/supabase/server";

export default async function LeaveApprovals() {
  const supabase = await createClient();

  const [{ data: leaves }, { data: students }, { data: guardians }] = await Promise.all([
    supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("students").select("id, first_name, last_name"),
    supabase.from("guardians").select("id, name"),
  ]);

  const studentNames = Object.fromEntries(
    (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approvals</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Leave requests</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Requests raised by parents. Approving or declining notifies the family.
        </p>
      </div>

      <LeaveApprovalList
        leaves={leaves ?? []}
        studentNames={studentNames}
        guardianNames={guardianNames}
      />
    </div>
  );
}
