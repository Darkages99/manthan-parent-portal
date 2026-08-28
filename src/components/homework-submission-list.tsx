"use client";

import { useState, useTransition } from "react";
import { toggleSubmission, toggleAllChecked, setHomeworkComment } from "@/app/(staff)/console/homework/actions";
import { useToast } from "./toast-provider";

type Student = { id: string; first_name: string; last_name: string };

/** Per-student done/not-done checklist for one homework assignment.
 *
 * `checked` sets the assignment's default: unchecked (the initial default
 * for new homework) means nobody's done it until the teacher marks a
 * student done; checked means everybody's done it unless the teacher marks
 * a student not done. `overrideIds` is the set of students who differ from
 * that default. Clicking "Mark all as checked" / "Reset to not done" flips
 * the default and clears existing overrides (see toggleAllChecked). */
export function HomeworkSubmissionList({
  homeworkId,
  students,
  overrideIds,
  checked,
  comments,
}: {
  homeworkId: string;
  students: Student[];
  overrideIds: string[];
  checked: boolean;
  comments: Record<string, string>;
}) {
  const toast = useToast();
  const [defaultChecked, setDefaultChecked] = useState(checked);
  const [overrides, setOverrides] = useState(new Set(overrideIds));
  const [flipping, setFlipping] = useState(false);
  const [, startTransition] = useTransition();

  function isDone(studentId: string): boolean {
    const overridden = overrides.has(studentId);
    return defaultChecked ? !overridden : overridden;
  }

  function toggle(studentId: string) {
    const nextDone = !isDone(studentId);
    setOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
    startTransition(async () => {
      try {
        await toggleSubmission(homeworkId, studentId, nextDone);
        toast.success(nextDone ? "Marked done" : "Marked not done");
      } catch {
        setOverrides((prev) => {
          const next = new Set(prev);
          if (next.has(studentId)) next.delete(studentId);
          else next.add(studentId);
          return next;
        });
      }
    });
  }

  function flipDefault() {
    const next = !defaultChecked;
    setFlipping(true);
    startTransition(async () => {
      try {
        await toggleAllChecked(homeworkId, next);
        setDefaultChecked(next);
        setOverrides(new Set());
        toast.success(next ? "Everyone marked done by default" : "Reset to not done by default");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      } finally {
        setFlipping(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate">
          {defaultChecked
            ? "Default: everyone done unless marked otherwise."
            : "Default: nobody done until marked."}
        </p>
        <button
          type="button"
          onClick={flipDefault}
          disabled={flipping}
          className="shrink-0 rounded-sm border border-hairline bg-surface px-3 py-1.5 text-sm font-semibold text-maroon shadow-[var(--shadow-card)] hover:bg-mist disabled:opacity-60"
        >
          {defaultChecked ? "Reset to not done" : "Mark all as checked"}
        </button>
      </div>

      <ul className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        {students.length === 0 && <li className="px-5 py-4 text-base text-slate">No students in this class.</li>}
        {students.map((s) => {
          const done = isDone(s.id);
          return (
            <li key={s.id} className="flex flex-col gap-2 px-5 py-3.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-base text-slate-strong">
                  {s.first_name} {s.last_name}
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={done} onChange={() => toggle(s.id)} />
                  <span className={done ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}>
                    {done ? "Done" : "Not done"}
                  </span>
                </label>
              </div>
              <CommentEditor homeworkId={homeworkId} studentId={s.id} initialComment={comments[s.id] ?? ""} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Inline remark editor for one student's homework — collapsed to the saved
 * comment (or an "Add remark" button when there is none) until clicked, then
 * a textarea + Save. Saving pushes a notification to the student's guardians
 * (see setHomeworkComment). */
function CommentEditor({
  homeworkId,
  studentId,
  initialComment,
}: {
  homeworkId: string;
  studentId: string;
  initialComment: string;
}) {
  const toast = useToast();
  const [comment, setComment] = useState(initialComment);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialComment);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await setHomeworkComment(homeworkId, studentId, draft);
        setComment(draft.trim());
        setEditing(false);
        toast.success(draft.trim() ? "Remark sent to parent" : "Remark cleared");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save remark");
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 pl-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='e.g. "Very well done" or "Needs more effort"'
          rows={2}
          autoFocus
          className="rounded-sm border border-hairline bg-mist/40 px-3 py-2 text-sm text-slate-strong outline-none focus:border-rust/60"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-sm bg-maroon px-3 py-1 text-xs font-semibold text-cream disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(comment);
              setEditing(false);
            }}
            disabled={isPending}
            className="rounded-sm border border-hairline px-3 py-1 text-xs font-semibold text-slate-strong"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return comment ? (
    <button
      type="button"
      onClick={() => {
        setDraft(comment);
        setEditing(true);
      }}
      className="pl-1 text-left text-sm text-slate-strong hover:underline"
    >
      &ldquo;{comment}&rdquo; <span className="text-slate">— edit</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="pl-1 text-left text-sm text-rust hover:underline"
    >
      + Add remark
    </button>
  );
}
