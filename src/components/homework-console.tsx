"use client";

import { useState, useTransition } from "react";
import { createHomework, updateHomework, deleteHomework } from "@/app/(staff)/console/homework/actions";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type Subject = { id: string; name: string };
type Homework = Tables<"homework_assignments">;

const inputCls =
  "rounded-sm border border-hairline bg-surface px-2 py-1.5 text-sm text-slate-strong";

function classLabel(c: ClassSection): string {
  return `Grade ${c.grade} - ${c.section}`;
}

/** Staff-facing homework editor: an editable table of existing assignments
 * (scoped by page.tsx to the classes this staff member may manage) plus an
 * "add new" row at the bottom, following the inline-edit pattern used by
 * ResultsEditor. */
export function HomeworkConsole({
  classes,
  subjects,
  homework,
}: {
  classes: ClassSection[];
  subjects: Subject[];
  homework: Homework[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[820px] text-left">
          <thead className="bg-maroon text-cream">
            <tr>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Due</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Class</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Subject</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Title</th>
              <th className="px-3 py-2.5 font-heading text-sm font-normal">Description</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {homework.map((h) => (
              <HomeworkRow key={h.id} homework={h} classes={classes} subjects={subjects} />
            ))}
            <AddHomeworkRow classes={classes} subjects={subjects} />
          </tbody>
        </table>
      </div>
      {homework.length === 0 && (
        <p className="text-sm text-slate">No homework set yet — add the first row above.</p>
      )}
    </div>
  );
}

function HomeworkRow({
  homework,
  classes,
  subjects,
}: {
  homework: Homework;
  classes: ClassSection[];
  subjects: Subject[];
}) {
  const [classId, setClassId] = useState(homework.class_section_id);
  const [subjectId, setSubjectId] = useState(homework.subject_id ?? "");
  const [title, setTitle] = useState(homework.title);
  const [description, setDescription] = useState(homework.description ?? "");
  const [dueDate, setDueDate] = useState(homework.due_date);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty =
    classId !== homework.class_section_id ||
    subjectId !== (homework.subject_id ?? "") ||
    title !== homework.title ||
    description !== (homework.description ?? "") ||
    dueDate !== homework.due_date;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateHomework(homework.id, {
          classSectionId: classId,
          subjectId: subjectId || null,
          title,
          description,
          dueDate,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this homework assignment?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteHomework(homework.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  return (
    <tr>
      <td className="px-3 py-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`w-36 ${inputCls}`}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className={`w-32 ${inputCls}`}
          aria-label="Class"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className={`w-32 ${inputCls}`}
          aria-label="Subject"
        >
          <option value="">— Subject —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-40 ${inputCls}`}
          aria-label="Title"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          className={`w-56 ${inputCls}`}
          aria-label="Description"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-sm bg-rust px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}

function AddHomeworkRow({ classes, subjects }: { classes: ClassSection[]; subjects: Subject[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        await createHomework({
          classSectionId: classId,
          subjectId: subjectId || null,
          title,
          description,
          dueDate,
        });
        setSubjectId("");
        setTitle("");
        setDescription("");
        setDueDate("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add");
      }
    });
  }

  return (
    <tr className="bg-mist/40">
      <td className="px-3 py-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`w-36 ${inputCls}`}
          aria-label="Due date"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className={`w-32 ${inputCls}`}
          aria-label="Class"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className={`w-32 ${inputCls}`}
          aria-label="Subject"
        >
          <option value="">— Subject —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Assignment title"
          className={`w-40 ${inputCls}`}
          aria-label="Title"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          className={`w-56 ${inputCls}`}
          aria-label="Description"
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={add}
          disabled={pending || !classId || !title.trim() || !dueDate}
          className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          Add
        </button>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}
