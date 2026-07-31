import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { getViewer } from "@/lib/session";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer) redirect("/");
  if (viewer.type === "guardian") redirect("/home");

  return <StaffShell staffName={viewer.staff.name}>{children}</StaffShell>;
}
