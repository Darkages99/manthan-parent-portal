import { redirect } from "next/navigation";
import { ParentShell } from "@/components/parent-shell";
import { SelectedChildProvider } from "@/lib/selected-child-context";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer) redirect("/");
  if (viewer.type === "staff") redirect("/console");

  const supabase = await createClient();
  const { count } = await supabase
    .from("message_receipts")
    .select("*", { count: "exact", head: true })
    .eq("guardian_id", viewer.guardian.id)
    .is("read_at", null);

  return (
    <SelectedChildProvider students={viewer.students}>
      <ParentShell guardianName={viewer.guardian.name.split(" ")[0]} unreadMessages={count ?? 0}>
        {children}
      </ParentShell>
    </SelectedChildProvider>
  );
}
