import { redirect } from "next/navigation";
import { ParentShell } from "@/components/parent-shell";
import { getViewer } from "@/lib/session";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer) redirect("/");
  if (viewer.type === "staff") redirect("/console");

  return <ParentShell guardianName={viewer.guardian.name.split(" ")[0]}>{children}</ParentShell>;
}
