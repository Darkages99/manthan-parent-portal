import { redirect } from "next/navigation";
import { NotificationSettingsView } from "@/components/notification-settings-view";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

type NotificationCategory = Enums<"notification_category">;

const ALL_CATEGORIES: NotificationCategory[] = ["stay_back", "leave", "ptm", "messages", "defaulters", "homework"];

export default async function NotificationSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");

  const supabase = await createClient();
  const ownerColumn = viewer.type === "guardian" ? "guardian_id" : "staff_id";
  const ownerId = viewer.type === "guardian" ? viewer.guardian.id : viewer.staff.id;

  const { data: rows } = await supabase
    .from("notification_preferences")
    .select("category, enabled")
    .eq(ownerColumn, ownerId);

  const disabled = new Set((rows ?? []).filter((r) => !r.enabled).map((r) => r.category));
  const initialEnabled = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, !disabled.has(c)])
  ) as Record<NotificationCategory, boolean>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Settings</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Notifications</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Choose which categories send you a push notification. Turning one off doesn&apos;t remove it from
          your in-app inbox — it only stops the alert.
        </p>
      </div>

      <NotificationSettingsView initialEnabled={initialEnabled} />
    </div>
  );
}
