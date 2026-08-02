import { redirect } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";

export default async function ConsoleGallery() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") redirect("/");
  if (!isPrincipalRole(viewer.staff.role)) redirect("/console");

  return (
    <ModulePlaceholder
      title="Photo gallery"
      phase="Phase 3"
      description="Pulled from the school's Flickr account, filterable by class, event or date — waiting on Flickr account access and the current album/tag convention."
    />
  );
}
