import Link from "next/link";
import { BellIcon } from "./icons";

export type Notification = {
  id: string;
  subject: string;
  body: string;
  sent_at: string | null;
  urgent: boolean;
  senderName: string | null;
};

/** True when a message arrived within the last three days. Kept out of the
 * component body so the current-time read isn't a render-time impurity. */
function isRecent(iso: string | null): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < 3 * 86_400_000;
}

function relativeDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** School notifications inbox for the dashboard. */
export function NotificationsInbox({ notifications }: { notifications: Notification[] }) {
  const unreadRecent = notifications.filter((n) => isRecent(n.sent_at)).length;

  return (
    <div className="flex h-full flex-col rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
        <BellIcon className="h-5 w-5 text-maroon" />
        <h2 className="font-heading text-xl text-maroon">Notifications</h2>
        {unreadRecent > 0 && (
          <span className="rounded-full bg-rust px-2 py-0.5 text-xs font-bold text-white">
            {unreadRecent} new
          </span>
        )}
        <Link href="/messages" className="ml-auto text-sm text-rust hover:underline">
          All
        </Link>
      </div>

      <ul className="max-h-[26rem] flex-1 divide-y divide-hairline overflow-y-auto">
        {notifications.map((n) => {
          const recent = isRecent(n.sent_at);
          return (
            <li key={n.id} className="flex gap-3 px-5 py-3.5">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  n.urgent ? "bg-rose-500" : recent ? "bg-rust" : "bg-transparent"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-semibold text-maroon">{n.subject}</p>
                  {n.urgent && (
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                      Urgent
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-strong">{n.body}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate">
                  {n.senderName ?? "School"} · {relativeDay(n.sent_at)}
                </p>
              </div>
            </li>
          );
        })}
        {notifications.length === 0 && (
          <li className="px-5 py-8 text-center text-base text-slate">No notifications yet.</li>
        )}
      </ul>
    </div>
  );
}
