import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PendingDeletionsList } from "@/components/pending-deletions-list";

export default async function ConsolePendingDeletions() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("sheet_sync_pending_deletions")
    .select("*")
    .is("resolved_at", null)
    .order("detected_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/console/sync" className="text-sm font-semibold text-rust">
          ← Sheet sync
        </Link>
        <p className="mt-2 font-heading text-sm uppercase tracking-[0.18em] text-rust">Administration</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Pending deletions</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          These rows disappeared from the roster sheet. They are kept in Postgres until a super admin
          confirms the removal — this protects attendance, results and other records linked to them.
          {viewer.staff.role !== "super_admin" &&
            " Only a super admin can confirm; you can review these but not delete them."}
        </p>
      </div>

      <PendingDeletionsList pending={pending ?? []} canConfirm={viewer.staff.role === "super_admin"} />
    </div>
  );
}
