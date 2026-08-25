"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, createCustomGroup } from "@/app/(staff)/console/messages/compose/actions";
import { TypeaheadPicker, type TypeaheadOption } from "./typeahead-picker";
import { useToast } from "./toast-provider";
import type { Tables, Enums } from "@/lib/supabase/database.types";

type RecipientMode = Enums<"message_scope_type">;
type StudentOption = { id: string; label: string; classSectionId: string };
type GroupOption = { id: string; name: string };

function classCode(c: Tables<"class_sections">): string {
  return `${c.grade}${c.section}`;
}

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

  const classOptions: TypeaheadOption[] = useMemo(
    () => classSections.map((c) => ({ id: c.id, label: `Grade ${c.grade} - ${c.section}` })),
    [classSections]
  );
  const classCodeById = useMemo(
    () => new Map(classSections.map((c) => [c.id, classCode(c)])),
    [classSections]
  );
  const studentOptions: TypeaheadOption[] = useMemo(
    () =>
      students.map((s) => ({ id: s.id, label: s.label, sublabel: classCodeById.get(s.classSectionId) })),
    [students, classCodeById]
  );
  const groupOptions: TypeaheadOption[] = useMemo(
    () => groups.map((g) => ({ id: g.id, label: g.name })),
    [groups]
  );

  // Students implied by the current selection — used for "save as group".
  const selectionStudentIds = useMemo(() => {
    if (mode === "student") return selectedStudents;
    if (mode === "class")
      return students.filter((s) => selectedClasses.includes(s.classSectionId)).map((s) => s.id);
    return [];
  }, [mode, selectedStudents, selectedClasses, students]);

  function onModeChange(m: RecipientMode) {
    setMode(m);
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
      toast.celebrate("Message sent to parents");
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
                {m === "student" && "Individual student(s)"}
                {m === "group" && "Custom group"}
              </button>
            ))}
          </div>

          {mode === "school" && (
            <p className="mt-3 rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-base text-slate-strong">
              This message goes to every parent in the school.
            </p>
          )}

          {mode === "class" && (
            <div className="mt-3">
              <TypeaheadPicker
                options={classOptions}
                selected={selectedClasses}
                onChange={setSelectedClasses}
                placeholder="Search classes…"
              />
            </div>
          )}
          {mode === "student" && (
            <div className="mt-3">
              <TypeaheadPicker
                options={studentOptions}
                selected={selectedStudents}
                onChange={setSelectedStudents}
                placeholder="Search students — pick as many as you like…"
                maxResults={10}
              />
              <p className="mt-1.5 text-sm text-slate">
                Sends immediately to everyone picked — no need to save a group first.
              </p>
            </div>
          )}
          {mode === "group" && (
            <div className="mt-3">
              <TypeaheadPicker
                options={groupOptions}
                selected={selectedGroups}
                onChange={setSelectedGroups}
                placeholder="Search custom groups…"
              />
              {groups.length === 0 && (
                <p className="mt-1.5 text-sm text-slate">No custom groups yet.</p>
              )}
            </div>
          )}

          {/* Inline save-as-group */}
          {canSaveGroup && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-hairline bg-mist/40 px-3 py-2.5">
              <span className="text-sm text-slate-strong">
                Save these {selectionStudentIds.length} student{selectionStudentIds.length === 1 ? "" : "s"} as a group for later:
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
