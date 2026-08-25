"use client";

import { useState, useTransition } from "react";
import {
  assignClassTeacher,
  addClassSubjectTeacher,
  removeClassSubjectTeacher,
} from "@/app/(staff)/console/classes/actions";
import { CloseIcon, PlusIcon } from "./icons";
import { useToast } from "./toast-provider";
import { SubjectPicker } from "./subject-picker";
import { ComboBox } from "./combobox";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type StaffLite = { id: string; name: string; role: Tables<"staff">["role"] };
type Named = { id: string; name: string };
type Assignment = Tables<"class_subject_teachers">;
type Student = Tables<"students">;

export function ClassDetail({
  cls,
  staff,
  subjects,
  classSubjectTeachers,
  students,
}: {
  cls: ClassSection;
  staff: StaffLite[];
  subjects: Named[];
  classSubjectTeachers: Assignment[];
  students: Student[];
}) {
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  return (
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
        <div className="w-full max-w-xs">
          <ComboBox
            options={staff.map((s) => ({ value: s.id, label: s.name }))}
            value={value}
            disabled={pending}
            onChange={onChange}
            emptyLabel="— Unassigned —"
            placeholder="Search staff…"
            ariaLabel="Class teacher"
          />
        </div>
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
        Drag a teacher onto a class in the sidebar&apos;s Classes list to also assign them there.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-maroon">Subject</span>
          <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-maroon">Teacher</span>
          <div className="w-56">
            <ComboBox
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              value={teacherId}
              onChange={setTeacherId}
              placeholder="Search teacher…"
              ariaLabel="Teacher"
              recallKey="class-subject-teacher"
            />
          </div>
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
        Drag a student onto a class in the sidebar&apos;s Classes list to move them there.
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
