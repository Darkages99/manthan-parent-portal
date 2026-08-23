"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  assignClassTeacher,
  addClassSubjectTeacher,
  removeClassSubjectTeacher,
  copyTeacherToClass,
  moveStudentToClass,
} from "@/app/(staff)/console/classes/actions";
import { CloseIcon, PlusIcon } from "./icons";
import { useToast } from "./toast-provider";
import { SubjectPicker } from "./subject-picker";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type ClassLite = Pick<ClassSection, "id" | "grade" | "section" | "academic_year">;
type StaffLite = { id: string; name: string; role: Tables<"staff">["role"] };
type Named = { id: string; name: string };
type Assignment = Tables<"class_subject_teachers">;
type Student = Tables<"students">;

export function ClassDetail({
  cls,
  otherClasses,
  staff,
  subjects,
  classSubjectTeachers,
  students,
}: {
  cls: ClassSection;
  otherClasses: ClassLite[];
  staff: StaffLite[];
  subjects: Named[];
  classSubjectTeachers: Assignment[];
  students: Student[];
}) {
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex flex-col gap-8">
        <ClassTeacherSection cls={cls} staff={staff} />
        <SubjectTeacherSection
          classSectionId={cls.id}
          subjects={subjects}
          staff={staff}
          assignments={classSubjectTeachers}
          subjectName={subjectName}
          staffName={staffName}
        />
        <StudentSection classSectionId={cls.id} students={students} />
      </div>

      <DropRail otherClasses={otherClasses} />
    </div>
  );
}

function ClassTeacherSection({ cls, staff }: { cls: ClassSection; staff: StaffLite[] }) {
  const toast = useToast();
  const [value, setValue] = useState(cls.class_teacher_id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await assignClassTeacher(cls.id, next || null);
        toast.success("Class teacher updated");
      } catch (e) {
        setValue(previous);
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <section className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl text-maroon">Class teacher</h2>
      <div className="mt-3 flex items-center gap-3">
        <select
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          className="w-full max-w-xs rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong disabled:opacity-60"
        >
          <option value="">— Unassigned —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {pending && <span className="text-sm text-slate">Saving…</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </section>
  );
}

function SubjectTeacherSection({
  classSectionId,
  subjects,
  staff,
  assignments,
  subjectName,
  staffName,
}: {
  classSectionId: string;
  subjects: Named[];
  staff: StaffLite[];
  assignments: Assignment[];
  subjectName: Map<string, string>;
  staffName: Map<string, string>;
}) {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(staff[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        if (!subjectId) throw new Error("Pick or add a subject");
        if (!teacherId) throw new Error("Pick a teacher");
        await addClassSubjectTeacher({ classSectionId, subjectId, teacherId });
        toast.success("Teacher assigned");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await removeClassSubjectTeacher(id, classSectionId);
        toast.success("Removed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove");
      }
    });
  }

  return (
    <section className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl text-maroon">Subjects &amp; teachers</h2>
      <p className="mt-1 text-sm text-slate">
        Drag a teacher onto another class in the rail to also assign them there.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-maroon">Subject</span>
          <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-maroon">Teacher</span>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={add}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-sm bg-maroon px-4 py-2 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      <ul className="mt-4 flex flex-col gap-2">
        {assignments.length === 0 && <li className="text-sm text-slate">No subject teachers assigned yet.</li>}
        {assignments.map((a) => (
          <li
            key={a.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-manthan-drag", JSON.stringify({ type: "teacher", id: a.id }));
            }}
            className="flex cursor-grab items-center justify-between gap-3 rounded-sm border border-hairline bg-mist px-3 py-2 text-base active:cursor-grabbing"
          >
            <span>
              <span className="font-semibold text-maroon">{subjectName.get(a.subject_id) ?? "Subject"}</span>
              <span className="text-slate-strong"> — {staffName.get(a.teacher_id) ?? "Teacher"}</span>
            </span>
            <button
              onClick={() => remove(a.id)}
              aria-label="Remove"
              className="rounded-sm p-1 text-slate hover:text-rose-600"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudentSection({ classSectionId, students }: { classSectionId: string; students: Student[] }) {
  return (
    <section className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl text-maroon">Students</h2>
      <p className="mt-1 text-sm text-slate">
        Drag a student onto another class in the rail to move them there.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {students.length === 0 && <li className="text-sm text-slate">No students in this class.</li>}
        {students.map((s) => (
          <li
            key={s.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/x-manthan-drag",
                JSON.stringify({ type: "student", id: s.id, classSectionId })
              );
            }}
            className="flex cursor-grab items-center gap-2 rounded-sm border border-hairline bg-mist px-3 py-2 text-base active:cursor-grabbing"
          >
            <span className="text-sm tabular-nums text-slate">{s.roll_no}</span>
            <span className="text-slate-strong">
              {s.first_name} {s.last_name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DropRail({ otherClasses }: { otherClasses: { id: string; grade: string; section: string }[] }) {
  const toast = useToast();
  const [overId, setOverId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onDrop(e: React.DragEvent, targetClassSectionId: string) {
    e.preventDefault();
    setOverId(null);
    const raw = e.dataTransfer.getData("application/x-manthan-drag");
    if (!raw) return;
    const payload = JSON.parse(raw) as { type: "teacher" | "student"; id: string };
    startTransition(async () => {
      try {
        if (payload.type === "teacher") {
          await copyTeacherToClass(payload.id, targetClassSectionId);
          setStatus("Teacher also assigned to that class.");
        } else {
          await moveStudentToClass(payload.id, targetClassSectionId);
          setStatus("Student moved to that class.");
        }
        toast.success("Done");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Couldn't complete the move");
      }
    });
  }

  return (
    <aside className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-maroon">Other classes</h2>
      <p className="text-sm text-slate">Drop a teacher or student card here.</p>
      {status && <p className="text-sm text-rust">{status}</p>}
      <ul className="flex flex-col gap-2">
        {otherClasses.map((c) => (
          <li key={c.id}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(c.id);
              }}
              onDragLeave={() => setOverId((v) => (v === c.id ? null : v))}
              onDrop={(e) => onDrop(e, c.id)}
              className={`rounded-sm border px-3 py-2.5 text-sm transition ${
                overId === c.id
                  ? "border-rust bg-rust/10 text-maroon"
                  : "border-hairline bg-surface text-slate-strong"
              }`}
            >
              <Link href={`/console/classes/${c.id}`} className="font-semibold text-maroon hover:underline">
                Grade {c.grade}-{c.section}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
