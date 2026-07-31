import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("*, message_attachments(*), staff(name)")
    .order("sent_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Inbox</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Messages</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Circulars and updates from the school, targeted to your child&apos;s class or you specifically.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {(messages ?? []).map((m) => (
          <li key={m.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex-1">
              <p className="text-base font-semibold text-maroon">{m.subject}</p>
              <p className="mt-1 text-base text-slate-strong">{m.body}</p>
              <p className="mt-2 text-sm uppercase tracking-wide text-slate">
                {m.staff?.name} ·{" "}
                {m.sent_at &&
                  new Date(m.sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </p>
              {m.message_attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.message_attachments.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-parchment px-2.5 py-1 text-sm text-maroon"
                    >
                      <span className="rounded-sm bg-maroon px-1.5 py-0.5 text-xs font-bold text-cream">
                        PDF
                      </span>
                      {a.file_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
        {(!messages || messages.length === 0) && (
          <p className="text-base text-slate">No messages yet.</p>
        )}
      </ul>
    </div>
  );
}
