/**
 * Web Push scaffold. Not wired to a real subscription store yet —
 * this is the shape the rest of the app should call once Supabase holds
 * push subscriptions (one row per guardian/staff device) and a server
 * action sends via the `web-push` package with VAPID keys.
 *
 * iOS Safari only supports this from 16.4+, and only after the parent has
 * added the app to their home screen (see the implementation plan, §08).
 * That's why urgent sends should never rely on push alone.
 */

export interface PushTarget {
  userId: string;
  role: "guardian" | "staff";
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // deep link opened on tap, e.g. /stay-back/sb-1
}

export async function sendPush(_targets: PushTarget[], _payload: PushPayload): Promise<void> {
  console.warn(
    "[push] not wired yet — needs VAPID keys + a push_subscriptions table in Supabase."
  );
}
