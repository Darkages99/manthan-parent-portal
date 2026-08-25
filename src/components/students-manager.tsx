"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudent, updateStudent, deleteStudent } from "@/app/(staff)/console/students/actions";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Toolbar, SearchInput } from "./filter-bar";
import { PlusIcon } from "./icons";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Student = Tables<"students">;
type ClassSection = { id: string; grade: string; section: string };

const inputCls = "rounded-sm border border-hairline bg-mist px-3 py-2 text-base";

function classLabel(c: Pick<ClassSection, "grade" | "section">): string {
  return `Grade ${c.grade} - ${c.section}`;
}

export function StudentsManager({
  students,
  classes,
  guardianNamesByStudent,
}: {
  students: Student[];
  classes: ClassSection[];
  guardianNamesByStudent: Record<string, string[]>;
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const cls = classById.get(s.class_section_id);
      const haystack = [
        s.first_name,
        s.last_name,
        s.roll_no,
        cls ? classLabel(cls) : "",
        ...(guardianNamesByStudent[s.id] ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [students, query, classById, guardianNamesByStudent]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Name, roll number, class, parent…"
          ariaLabel="Search students"
        />
        <Button
          className="ml-auto shrink-0"
          size="sm"
          onClick={() => setAddOpen(true)}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Add student
        </Button>
      </Toolbar>

      <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-hairline text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Roll no.</th>
              <th className="px-4 py-3 font-medium">Parent 1</th>
              <th className="px-4 py-3 font-medium">Parent 2</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate">
                  No students match.
                </td>
              </tr>
            )}
            {filtered.map((s) => {
              const cls = classById.get(s.class_section_id);
              const parents = guardianNamesByStudent[s.id] ?? [];
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-strong">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-strong">{cls ? classLabel(cls) : "—"}</td>
                  <td className="px-4 py-3 text-slate-strong">{s.roll_no}</td>
                  <td className="px-4 py-3 text-slate">{parents[0] ?? "—"}</td>
                  <td className="px-4 py-3 text-slate">{parents[1] ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="text-sm font-medium text-rust hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add student">
        <StudentForm classes={classes} onDone={() => setAddOpen(false)} />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit student">
        {editing && (
          <StudentForm classes={classes} student={editing} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </div>
  );
}

function StudentForm({
  classes,
  student,
  onDone,
}: {
  classes: ClassSection[];
  student?: Student;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [firstName, setFirstName] = useState(student?.first_name ?? "");
  const [lastName, setLastName] = useState(student?.last_name ?? "");
  const [rollNo, setRollNo] = useState(student?.roll_no ?? "");
  const [classSectionId, setClassSectionId] = useState(student?.class_section_id ?? classes[0]?.id ?? "");
  const [photoUrl, setPhotoUrl] = useState(student?.photo_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const input = { firstName, lastName, rollNo, classSectionId, photoUrl };
        if (student) {
          await updateStudent(student.id, input);
          toast.success("Saved");
        } else {
          await createStudent(input);
          toast.success("Student added");
        }
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!student) return;
    if (!confirm(`Delete ${student.first_name} ${student.last_name}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteStudent(student.id);
        toast.success("Student deleted");
        router.refresh();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">First name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Last name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Roll number</span>
          <input value={rollNo} onChange={(e) => setRollNo(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Class</span>
          <select value={classSectionId} onChange={(e) => setClassSectionId(e.target.value)} className={inputCls}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
          <span className="font-medium text-maroon">Photo URL (optional)</span>
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className={inputCls} />
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={submit}
          loading={pending}
          disabled={!firstName.trim() || !lastName.trim() || !rollNo.trim() || !classSectionId}
          className="px-5 py-2.5"
        >
          Save
        </Button>
        {student && (
          <Button type="button" variant="danger" size="sm" onClick={remove} disabled={pending}>
            Delete student
          </Button>
        )}
      </div>
    </div>
  );
}
