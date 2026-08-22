"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

type NotificationCategory = Enums<"notification_category">;

export async function setNotificationPreference(
  category: NotificationCategory,
  enabled: boolean
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Not signed in");

  const supabase = await createClient();
  const owner =
    viewer.type === "guardian"
      ? { guardian_id: viewer.guardian.id, staff_id: null }
      : { guardian_id: null, staff_id: viewer.staff.id };

  const onConflict = viewer.type === "guardian" ? "guardian_id,category" : "staff_id,category";

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ ...owner, category, enabled }, { onConflict });
  if (error) throw new Error(error.message);

  revalidatePath("/settings/notifications");
}
