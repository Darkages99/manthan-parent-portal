import { redirect } from "next/navigation";
import { StayBackApprovalList } from "@/components/stay-back-approval-list";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function StayBackApprovals() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();

  const [{ data: consents }, { data: students }, { data: teachers }, { data: guardians }] =
    await Promise.all([
      supabase.from("stay_back_consents").select("*").order("created_at", { ascending: false }),
      supabase.from("students").select("*"),
      supabase.from("staff").select("*"),
      supabase.from("guardians").select("id, phone"),
    ]);

  const guardianPhones = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.phone]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Approvals</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Stay-back consent</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Raised by a parent. Both the named teacher and the principal must approve — either one
          declining closes the request.
        </p>
      </div>

      <StayBackApprovalList
        consents={consents ?? []}
        students={students ?? []}
        teachers={teachers ?? []}
        guardianPhones={guardianPhones}
        viewer={viewer.staff}
      />
    </div>
  );
}
