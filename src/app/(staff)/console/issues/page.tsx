import { redirect } from "next/navigation";
import { IssueTriageList } from "@/components/issue-triage-list";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const NIL_ID = "00000000-0000-0000-0000-000000000000";

export default async function IssuesPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");

  const supabase = await createClient();

  // RLS already scopes what comes back: non-confidential rows for any staff,
  // confidential rows additionally for the principal/super_admin.
  const { data: issues } = await supabase
    .from("reported_issues")
    .select("*")
    .order("created_at", { ascending: false });

  const all = issues ?? [];
  const guardianIds = [...new Set(all.map((i) => i.reported_by_guardian_id).filter((id): id is string => !!id))];
  const staffIds = [...new Set(all.map((i) => i.reported_by_staff_id).filter((id): id is string => !!id))];

  const [{ data: guardians }, { data: staff }] = await Promise.all([
    supabase.from("guardians").select("id, name").in("id", guardianIds.length ? guardianIds : [NIL_ID]),
    supabase.from("staff").select("id, name").in("id", staffIds.length ? staffIds : [NIL_ID]),
  ]);

  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));
  const staffNames = Object.fromEntries((staff ?? []).map((s) => [s.id, s.name]));

  const reporterNames: Record<string, string> = {};
  for (const i of all) {
    if (i.reported_by_guardian_id) {
      reporterNames[i.id] = guardianNames[i.reported_by_guardian_id] ?? "a guardian";
    } else if (i.reported_by_staff_id) {
      reporterNames[i.id] = staffNames[i.reported_by_staff_id] ?? "a staff member";
    }
  }

  const open = all.filter((i) => i.status === "open");
  const resolved = all.filter((i) => i.status === "resolved");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Feedback</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Reported issues</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Issues raised by parents and staff. Non-confidential reports are visible to all staff;
          confidential ones only to the principal.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">
          Open{open.length > 0 && ` · ${open.length}`}
        </h2>
        <IssueTriageList issues={open} reporterNames={reporterNames} emptyLabel="Nothing open right now." />
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Resolved</h2>
        <IssueTriageList issues={resolved} reporterNames={reporterNames} emptyLabel="No resolved issues yet." />
      </section>
    </div>
  );
}
