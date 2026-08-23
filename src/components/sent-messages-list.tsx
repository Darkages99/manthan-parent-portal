"use client";

import { useMemo, useState } from "react";
import { formatSlotTime } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

type Message = Tables<"messages"> & {
  staff: { name: string } | null;
  message_attachments: Tables<"message_attachments">[];
  message_targets: Tables<"message_targets">[];
};

/** Read-only log of messages already sent, newest first, with a single search
 * bar filtering by subject or body text. */
export function SentMessagesList({
  messages,
  classNames,
  studentNames,
  groupNames,
}: {
  messages: Message[];
  classNames: Record<string, string>;
  studentNames: Record<string, string>;
  groupNames: Record<string, string>;
}) {
  const [query, setQuery] = useState("");

  function recipientSummary(m: Message): string {
    if (m.scope_type === "school") return "Whole school";
    const names = m.message_targets
      .map((t) => {
        if (t.class_section_id) return classNames[t.class_section_id];
        if (t.student_id) return studentNames[t.student_id];
        if (t.custom_group_id) return groupNames[t.custom_group_id];
        return null;
      })
      .filter((n): n is string => !!n);
    return names.length ? names.join(", ") : "—";
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) => m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q)
    );
  }, [messages, query]);

  if (messages.length === 0) {
    return <p className="text-base text-slate">No messages sent yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search sent messages by title or content…"
        className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
      />
      {filtered.length === 0 ? (
        <p className="text-base text-slate">No messages match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-semibold text-maroon">{m.subject}</p>
                {m.urgent && (
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                    Urgent
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-base text-slate-strong">{m.body}</p>
              <p className="mt-2 text-sm uppercase tracking-wide text-slate">
                To {recipientSummary(m)}
                {m.staff?.name && ` · ${m.staff.name}`}
                {m.sent_at && ` · ${formatSlotTime(m.sent_at)}`}
              </p>
              {m.message_attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.message_attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-parchment px-2.5 py-1 text-sm text-maroon transition hover:border-rust/60 hover:bg-mist"
                    >
                      <span className="rounded-sm bg-maroon px-1.5 py-0.5 text-xs font-bold text-cream">
                        PDF
                      </span>
                      {a.file_name}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
