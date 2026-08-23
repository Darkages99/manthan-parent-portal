"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, createCustomGroup } from "@/app/(staff)/console/messages/compose/actions";
import { CloseIcon } from "./icons";
import { useToast } from "./toast-provider";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type RecipientMode = Enums<"message_scope_type">;
type StudentOption = { id: string; label: string; classSectionId: string };
type GroupOption = { id: string; name: string };

const MAX_RENDERED = 60;

export function ComposeForm({
  classSections,
  students,
  groups,
  isTeacher = false,
}: {
  classSections: Tables<"class_sections">[];
  students: StudentOption[];
  groups: GroupOption[];
  /** Teachers never get the "whole school" recipient mode. */
  isTeacher?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<RecipientMode>("class");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupSaved, setGroupSaved] = useState(false);
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

  const classLabel = (id: string) => {
    const c = classSections.find((cs) => cs.id === id);
    return c ? `Grade ${c.grade}-${c.section}` : id;
  };
  const studentLabel = (id: string) => students.find((s) => s.id === id)?.label ?? id;
  const groupLabel = (id: string) => groups.find((g) => g.id === id)?.name ?? id;

  // Filtered lists for the searchable pickers.
  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classSections.filter((c) => `grade ${c.grade}-${c.section}`.includes(q));
  }, [classSections, query]);
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? students.filter((s) => s.label.toLowerCase().includes(q)) : students).slice(
      0,
      MAX_RENDERED
    );
  }, [students, query]);
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  // Students implied by the current selection — used for "save as group".
  const selectionStudentIds = useMemo(() => {
    if (mode === "student") return selectedStudents;
    if (mode === "class")
      return students.filter((s) => selectedClasses.includes(s.classSectionId)).map((s) => s.id);
    return [];
  }, [mode, selectedStudents, selectedClasses, students]);

  function onModeChange(m: RecipientMode) {
    setMode(m);
    setQuery("");
    setGroupSaved(false);
  }

  async function saveGroup() {
    setError(null);
    setGroupSaving(true);
    try {
      const id = await createCustomGroup(groupName, selectionStudentIds);
      setGroupName("");
      setGroupSaved(true);
      router.refresh();
      // Switch to the group we just made so it's ready to send.
      setMode("group");
      setSelectedGroups([id]);
      setSelectedStudents([]);
      setSelectedClasses([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const messageId = await sendMessage({
        subject,
        body,
        urgent,
        scopeType: mode,
        classSectionIds: selectedClasses,
        studentIds: selectedStudents,
        groupIds: selectedGroups,
      });

      if (attachment) {
        const form = new FormData();
        form.set("messageId", messageId);
        form.set("file", attachment);
        const res = await fetch("/api/attachments/upload", { method: "POST", body: form });
        if (!res.ok) {
          const { error: uploadError } = await res.json();
          throw new Error(uploadError ?? "Attachment upload failed");
        }
      }

      setSent(true);
      setSubject("");
      setBody("");
      setSelectedClasses([]);
      setSelectedStudents([]);
      setSelectedGroups([]);
      setAttachment(null);
      router.refresh();
      toast.success("Message sent");
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const canSaveGroup = (mode === "student" || mode === "class") && selectionStudentIds.length > 0;

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
            {(isTeacher
              ? (["class", "student", "group"] as RecipientMode[])
              : (["school", "class", "student", "group"] as RecipientMode[])
            ).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
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

          {mode === "school" && (
            <p className="mt-3 rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-base text-slate-strong">
              This message goes to every parent in the school.
            </p>
          )}

          {mode !== "school" && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Selected chips */}
              {mode === "class" && selectedClasses.length > 0 && (
                <ChipRow ids={selectedClasses} label={classLabel} onRemove={(id) => toggle(selectedClasses, setSelectedClasses, id)} />
              )}
              {mode === "student" && selectedStudents.length > 0 && (
                <ChipRow ids={selectedStudents} label={studentLabel} onRemove={(id) => toggle(selectedStudents, setSelectedStudents, id)} />
              )}
              {mode === "group" && selectedGroups.length > 0 && (
                <ChipRow ids={selectedGroups} label={groupLabel} onRemove={(id) => toggle(selectedGroups, setSelectedGroups, id)} />
              )}

              {/* Search + checkbox list */}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === "class" ? "Search classes…" : mode === "student" ? "Search students…" : "Search groups…"
                }
                className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
              />
              <ul className="max-h-56 divide-y divide-hairline overflow-y-auto rounded-sm border border-hairline">
                {mode === "class" &&
                  filteredClasses.map((c) => (
                    <PickRow
                      key={c.id}
                      checked={selectedClasses.includes(c.id)}
                      onToggle={() => toggle(selectedClasses, setSelectedClasses, c.id)}
                      label={`Grade ${c.grade} - ${c.section}`}
                    />
                  ))}
                {mode === "student" &&
                  filteredStudents.map((s) => (
                    <PickRow
                      key={s.id}
                      checked={selectedStudents.includes(s.id)}
                      onToggle={() => toggle(selectedStudents, setSelectedStudents, s.id)}
                      label={s.label}
                    />
                  ))}
                {mode === "group" &&
                  filteredGroups.map((g) => (
                    <PickRow
                      key={g.id}
                      checked={selectedGroups.includes(g.id)}
                      onToggle={() => toggle(selectedGroups, setSelectedGroups, g.id)}
                      label={g.name}
                    />
                  ))}
                {((mode === "class" && filteredClasses.length === 0) ||
                  (mode === "student" && filteredStudents.length === 0) ||
                  (mode === "group" && filteredGroups.length === 0)) && (
                  <li className="px-4 py-3 text-sm text-slate">
                    {mode === "group" ? "No custom groups yet." : "No matches."}
                  </li>
                )}
              </ul>
              {mode === "student" && students.length > MAX_RENDERED && (
                <p className="text-sm text-slate">Showing the first {MAX_RENDERED} — search to narrow down.</p>
              )}

              {/* Inline save-as-group */}
              {canSaveGroup && (
                <div className="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-hairline bg-mist/40 px-3 py-2.5">
                  <span className="text-sm text-slate-strong">
                    Save these {selectionStudentIds.length} student{selectionStudentIds.length === 1 ? "" : "s"} as a group:
                  </span>
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                    className="flex-1 rounded-sm border border-hairline bg-surface px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveGroup}
                    disabled={groupSaving || !groupName.trim()}
                    className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                  >
                    {groupSaving ? "Saving…" : "Save group"}
                  </button>
                  {groupSaved && <span className="text-sm text-emerald-700">Saved.</span>}
                </div>
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
            {attachment ? attachment.name : "Optional — PDF only, 10MB max."}
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

function ChipRow({
  ids,
  label,
  onRemove,
}: {
  ids: string[];
  label: (id: string) => string;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-3 py-1 text-sm text-cream"
        >
          {label(id)}
          <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${label(id)}`}>
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

function PickRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-base hover:bg-mist">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="text-slate-strong">{label}</span>
      </label>
    </li>
  );
}
