import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";

/**
 * Single post-authentication landing spot for every login method (password,
 * phone OTP, Google OAuth). Sends guardians to /home and staff to /console —
 * previously every login flow redirected straight to /home regardless of
 * viewer type, so a staff sign-in would bounce silently back to / (since
 * /home itself redirects non-guardians away), looking like login "did
 * nothing."
 */
export default async function PostLogin() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  redirect(viewer.type === "guardian" ? "/home" : "/console");
}
