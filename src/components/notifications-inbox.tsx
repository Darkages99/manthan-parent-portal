import Link from "next/link";
import { BellIcon, CheckCircleIcon } from "./icons";

export type Notification = {
  id: string;
  subject: string;
  body: string;
  sent_at: string | null;
  urgent: boolean;
  senderName: string | null;
  /** Whether this guardian has an unread receipt for the message. */
  unread: boolean;
};

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

/** School notifications inbox for the dashboard — shows only new (unread) messages. */
export function NotificationsInbox({ notifications }: { notifications: Notification[] }) {
  const unread = notifications.filter((n) => n.unread);

  return (
    <div className="flex h-full flex-col rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
        <BellIcon className="h-5 w-5 text-maroon" />
        <h2 className="font-heading text-xl text-maroon">Notifications</h2>
        {unread.length > 0 && (
          <span className="rounded-full bg-rust px-2 py-0.5 text-xs font-bold text-white">
            {unread.length} new
          </span>
        )}
        <Link href="/messages" className="ml-auto text-sm text-rust hover:underline">
          All
        </Link>
      </div>

      {unread.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
          <p className="text-base font-medium text-slate-strong">You&apos;re all caught up</p>
          <p className="text-sm text-slate">No new messages right now.</p>
        </div>
      ) : (
        <ul className="max-h-[26rem] flex-1 divide-y divide-hairline overflow-y-auto">
          {unread.map((n) => (
            <li key={n.id} className="flex gap-3 px-5 py-3.5">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.urgent ? "bg-rose-500" : "bg-rust"}`}
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
          ))}
        </ul>
      )}
    </div>
  );
}
