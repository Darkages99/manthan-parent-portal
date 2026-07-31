"use client";

import { useState } from "react";
import { sendMessage } from "@/app/(staff)/console/messages/compose/actions";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type RecipientMode = Enums<"message_scope_type">;
type StudentOption = { id: string; label: string };
type GroupOption = { id: string; name: string };

export function ComposeForm({
  classSections,
  students,
  groups,
}: {
  classSections: Tables<"class_sections">[];
  students: StudentOption[];
  groups: GroupOption[];
}) {
  const [mode, setMode] = useState<RecipientMode>("class");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await sendMessage({
        subject,
        body,
        urgent,
        scopeType: mode,
        classSectionIds: selectedClasses,
        studentIds: selectedStudents,
        groupIds: selectedGroups,
      });
      setSent(true);
      setSubject("");
      setBody("");
      setSelectedClasses([]);
      setSelectedStudents([]);
      setSelectedGroups([]);
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]"
    >
      <div className="border-b border-hairline bg-maroon px-6 py-3 font-heading text-base text-cream">
        New message
      </div>
      <div className="flex flex-col gap-5 p-6">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">Recipients</p>
          <div className="flex flex-wrap gap-2">
            {(["school", "class", "student", "group"] as RecipientMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full border px-4 py-1.5 text-base transition ${
                  mode === m ? "border-rust bg-rust text-white" : "border-hairline bg-mist text-slate-strong"
                }`}
              >
                {m === "school" && "Whole school"}
                {m === "class" && "By class"}
                {m === "student" && "Individual student"}
                {m === "group" && "Custom group"}
              </button>
            ))}
          </div>

          {mode === "class" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {classSections.map((cs) => (
                <button
                  key={cs.id}
                  type="button"
                  onClick={() => toggle(selectedClasses, setSelectedClasses, cs.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selectedClasses.includes(cs.id)
                      ? "border-maroon bg-maroon text-cream"
                      : "border-hairline bg-mist text-slate-strong"
                  }`}
                >
                  Grade {cs.grade} - {cs.section}
                </button>
              ))}
            </div>
          )}

          {mode === "student" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(selectedStudents, setSelectedStudents, s.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selectedStudents.includes(s.id)
                      ? "border-maroon bg-maroon text-cream"
                      : "border-hairline bg-mist text-slate-strong"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              {students.length === 0 && <p className="text-sm text-slate">No students found.</p>}
            </div>
          )}

          {mode === "group" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggle(selectedGroups, setSelectedGroups, g.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selectedGroups.includes(g.id)
                      ? "border-maroon bg-maroon text-cream"
                      : "border-hairline bg-mist text-slate-strong"
                  }`}
                >
                  {g.name}
                </button>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-slate">No custom groups created yet.</p>
              )}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
            placeholder="Term 2 fee due date reminder"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
            placeholder="Write the message parents will see..."
          />
        </label>

        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Attachment (PDF)</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            className="rounded-sm border border-dashed border-hairline bg-mist px-3 py-2.5 text-base"
          />
          <span className="text-sm text-slate">
            {attachment ? attachment.name : "Upload isn't wired to storage yet — see README."}
          </span>
        </label>

        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          <span>
            Mark urgent <span className="text-slate">— adds SMS + WhatsApp nudge fallback</span>
          </span>
        </label>

        <div>
          <button
            type="submit"
            disabled={sending}
            className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
          {sent && <span className="ml-3 text-base text-emerald-700">Sent.</span>}
          {error && <span className="ml-3 text-base text-rose-700">{error}</span>}
        </div>
      </div>
    </form>
  );
}
