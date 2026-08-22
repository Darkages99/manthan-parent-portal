import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatSlotTime } from "@/lib/format";
import { createReminder, cancelReminder } from "./actions";

export default async function RemindersPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") redirect("/");

  const supabase = await createClient();
  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("guardian_id", viewer.guardian.id)
    .order("remind_at", { ascending: true });

  const upcoming = (reminders ?? []).filter((r) => !r.sent_at);
  const sent = (reminders ?? [])
    .filter((r) => r.sent_at)
    .sort((a, b) => (a.remind_at < b.remind_at ? 1 : -1));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Stay on top of it</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Reminders</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Set a reminder for yourself — you&apos;ll get a push notification when it&apos;s due.
        </p>
      </div>

      <form
        action={createReminder}
        className="grid gap-5 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
          <span className="font-medium text-maroon">Message</span>
          <textarea
            name="message"
            required
            rows={2}
            placeholder="e.g. Pay the term fee"
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Remind me at</span>
          <input
            type="datetime-local"
            name="remindAt"
            required
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>

        <div className="flex items-end sm:col-span-1">
          <button
            type="submit"
            className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream transition hover:bg-maroon-strong"
          >
            Set reminder
          </button>
        </div>
      </form>

      <div>
        <h2 className="font-heading text-2xl text-maroon">Upcoming</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {upcoming.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-4 rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div>
                <p className="text-base font-semibold text-maroon">{r.message}</p>
                <p className="mt-1 text-base text-slate-strong">{formatSlotTime(r.remind_at)}</p>
              </div>
              <form action={cancelReminder.bind(null, r.id)}>
                <button
                  type="submit"
                  className="shrink-0 rounded-sm border border-hairline bg-mist px-4 py-2.5 text-base font-semibold text-maroon hover:bg-parchment"
                >
                  Cancel
                </button>
              </form>
            </li>
          ))}
          {upcoming.length === 0 && <p className="text-base text-slate">No upcoming reminders.</p>}
        </ul>
      </div>

      {sent.length > 0 && (
        <div>
          <h2 className="font-heading text-2xl text-maroon">Sent</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {sent.map((r) => (
              <li
                key={r.id}
                className="rounded-sm border border-hairline bg-surface p-5 opacity-70 shadow-[var(--shadow-card)]"
              >
                <p className="text-base font-semibold text-maroon">{r.message}</p>
                <p className="mt-1 text-base text-slate-strong">{formatSlotTime(r.remind_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
