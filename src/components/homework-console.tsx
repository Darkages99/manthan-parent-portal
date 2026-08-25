"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createHomework, updateHomework, deleteHomework } from "@/app/(staff)/console/homework/actions";
import { SubjectPicker } from "./subject-picker";
import { ComboBox } from "./combobox";
import { Button } from "./button";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type Subject = { id: string; name: string };
type Homework = Tables<"homework_assignments">;

const inputCls = "rounded-sm border border-hairline bg-mist px-3 py-2 text-base";

function classLabel(c: ClassSection | undefined): string {
  return c ? `Grade ${c.grade} - ${c.section}` : "Class";
}

/** Staff-facing homework screen: a compact create form up top, and existing
 * assignments below as cards — split into Current (due date not passed) and
 * Past, the latter showing how many students haven't submitted and linking
 * to the per-student checklist. */
export function HomeworkConsole({
  classes,
  subjects,
  homework,
  notSubmittedCounts,
  today,
}: {
  classes: ClassSection[];
  subjects: Subject[];
  homework: Homework[];
  notSubmittedCounts: Record<string, number>;
  today: string;
}) {
  const current = homework.filter((h) => h.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const past = homework
    .filter((h) => h.due_date < today)
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  const classById = new Map(classes.map((c) => [c.id, c]));
  const subjectById = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-8">
      <AddHomeworkForm classes={classes} subjects={subjects} />

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Current homework</h2>
        {current.length === 0 ? (
          <p className="text-base text-slate">Nothing due yet — add homework above.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((h) => (
              <CurrentHomeworkCard
                key={h.id}
                homework={h}
                classes={classes}
                subjects={subjects}
                classLabelText={classLabel(classById.get(h.class_section_id))}
                subjectName={h.subject_id ? subjectById.get(h.subject_id) : undefined}
                notSubmittedCount={notSubmittedCounts[h.id] ?? 0}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl text-maroon">Past homework</h2>
        {past.length === 0 ? (
          <p className="text-base text-slate">No past homework yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/console/homework/${h.id}`}
                  className="flex h-full flex-col gap-1.5 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-rust/60"
                >
                  <p className="font-semibold text-maroon">{h.title}</p>
                  <p className="text-sm text-slate-strong">
                    {classLabel(classById.get(h.class_section_id))}
                    {h.subject_id && subjectById.get(h.subject_id) && ` · ${subjectById.get(h.subject_id)}`}
                  </p>
                  <p className="text-sm text-slate">Due {h.due_date}</p>
                  <p className="mt-auto pt-2 text-sm font-semibold text-rust">
                    {(notSubmittedCounts[h.id] ?? 0) > 0
                      ? `${notSubmittedCounts[h.id]} not submitted →`
                      : "All submitted →"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CurrentHomeworkCard({
  homework,
  classes,
  subjects,
  classLabelText,
  subjectName,
  notSubmittedCount,
}: {
  homework: Homework;
  classes: ClassSection[];
  subjects: Subject[];
  classLabelText: string;
  subjectName?: string;
  notSubmittedCount: number;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [classId, setClassId] = useState(homework.class_section_id);
  const [subjectId, setSubjectId] = useState(homework.subject_id ?? "");
  const [title, setTitle] = useState(homework.title);
  const [description, setDescription] = useState(homework.description ?? "");
  const [dueDate, setDueDate] = useState(homework.due_date);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        toast.success("Saved");
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this homework assignment?")) return;
    startTransition(async () => {
      try {
        await deleteHomework(homework.id);
        toast.success("Deleted");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2.5 rounded-sm border border-rust/50 bg-surface p-4 shadow-[var(--shadow-card)]">
        <ComboBox
          options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
          value={classId}
          onChange={setClassId}
          required
          ariaLabel="Class"
          placeholder="Search class…"
          recallKey="homework-class"
          className={inputCls}
        />
        <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} className={inputCls} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} aria-label="Title" />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          className={inputCls}
          aria-label="Description"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputCls}
          aria-label="Due date"
        />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={save} loading={pending}>
            Save
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1.5 rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-rust/60">
      <Link href={`/console/homework/${homework.id}`} className="flex flex-col gap-1.5">
        <p className="font-semibold text-maroon">{homework.title}</p>
        <p className="text-sm text-slate-strong">
          {classLabelText}
          {subjectName && ` · ${subjectName}`}
        </p>
        {homework.description && <p className="text-sm text-slate">{homework.description}</p>}
        <p className="text-sm text-slate">Due {homework.due_date}</p>
        <p className="pt-1 text-sm font-semibold text-rust">
          {notSubmittedCount > 0 ? `${notSubmittedCount} not done →` : "All done →"}
        </p>
      </Link>
      <div className="mt-auto flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-rust hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-60"
        >
          Delete
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </li>
  );
}

function AddHomeworkForm({ classes, subjects }: { classes: ClassSection[]; subjects: Subject[] }) {
  const toast = useToast();
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
        toast.celebrate("Homework posted");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add");
      }
    });
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-xl text-maroon">Set homework</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Class</span>
          <ComboBox
            options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
            value={classId}
            onChange={setClassId}
            required
            ariaLabel="Class"
            placeholder="Search class…"
            recallKey="homework-class"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Subject</span>
          <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
          <span className="font-medium text-maroon">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details"
            className={inputCls}
          />
        </label>
      </div>
      <Button
        type="button"
        onClick={add}
        loading={pending}
        disabled={!classId || !title.trim() || !dueDate}
        className="mt-4 px-5 py-2.5"
      >
        Add homework
      </Button>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
