"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudent, updateStudent, deleteStudent, eraseStudent } from "@/app/(staff)/console/students/actions";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Toolbar, SearchInput } from "./filter-bar";
import { ComboBox } from "./combobox";
import { TypeaheadPicker } from "./typeahead-picker";
import { CreateFab } from "./create-fab";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Student = Tables<"students">;
type ClassSection = { id: string; grade: string; section: string };
type Guardian = { id: string; name: string };

const inputCls = "rounded-sm border border-hairline bg-mist px-3 py-2 text-base";

function classLabel(c: Pick<ClassSection, "grade" | "section">): string {
  return `Grade ${c.grade} - ${c.section}`;
}

export function StudentsManager({
  students,
  classes,
  guardians,
  guardianNamesByStudent,
  canErase = false,
}: {
  students: Student[];
  classes: ClassSection[];
  guardians: Guardian[];
  guardianNamesByStudent: Record<string, string[]>;
  /** Super-admin only: enables the permanent right-to-erasure control (DG-1). */
  canErase?: boolean;
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
      </Toolbar>
      <CreateFab label="Add student" onClick={() => setAddOpen(true)} />

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
        <StudentForm classes={classes} guardians={guardians} onDone={() => setAddOpen(false)} />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit student">
        {editing && (
          <StudentForm
            classes={classes}
            guardians={guardians}
            student={editing}
            canErase={canErase}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function StudentForm({
  classes,
  guardians,
  student,
  canErase = false,
  onDone,
}: {
  classes: ClassSection[];
  guardians: Guardian[];
  student?: Student;
  canErase?: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [firstName, setFirstName] = useState(student?.first_name ?? "");
  const [lastName, setLastName] = useState(student?.last_name ?? "");
  const [rollNo, setRollNo] = useState(student?.roll_no ?? "");
  const [classSectionId, setClassSectionId] = useState(student?.class_section_id ?? classes[0]?.id ?? "");
  const [photoUrl, setPhotoUrl] = useState(student?.photo_url ?? "");
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const guardianOptions = useMemo(
    () => guardians.map((g) => ({ id: g.id, label: g.name })),
    [guardians]
  );

  function submit() {
    setError(null);
    if (!student && parentIds.length === 0) {
      setError("Choose at least one parent");
      return;
    }
    startTransition(async () => {
      try {
        const input = { firstName, lastName, rollNo, classSectionId, photoUrl };
        if (student) {
          await updateStudent(student.id, input);
          toast.success("Saved");
        } else {
          await createStudent(input, parentIds);
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

  function erase() {
    if (!student) return;
    const name = `${student.first_name} ${student.last_name}`;
    // Two-step confirmation for an irreversible, cross-table erasure.
    if (
      !confirm(
        `ERASE ALL DATA for ${name}?\n\nThis permanently deletes the student and every ` +
          `record about them (attendance, results, homework, requests, messages, files) ` +
          `across the whole system, plus any parent left with no other children. This ` +
          `cannot be undone and is for data-protection (DPDP) erasure requests only.`
      )
    )
      return;
    if (confirm(`Type-check: really erase ${name}? Press OK only if you are certain.`) === false) return;
    startTransition(async () => {
      try {
        await eraseStudent(student.id);
        toast.success("Student data erased");
        router.refresh();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't erase");
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
          <ComboBox
            options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
            value={classSectionId}
            onChange={setClassSectionId}
            required
            ariaLabel="Class"
            placeholder="Search class…"
            recallKey="students-class"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base sm:col-span-2">
          <span className="font-medium text-maroon">Photo URL (optional)</span>
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className={inputCls} />
        </label>
      </div>

      {student ? (
        <p className="text-sm text-slate">
          Parents are managed from the Parents section.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Parent(s)</span>
          <TypeaheadPicker
            options={guardianOptions}
            selected={parentIds}
            onChange={setParentIds}
            placeholder="Search parents…"
          />
          <span className="text-sm text-slate">A student must have at least one parent.</span>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={submit}
          loading={pending}
          disabled={
            !firstName.trim() ||
            !lastName.trim() ||
            !rollNo.trim() ||
            !classSectionId ||
            (!student && parentIds.length === 0)
          }
          className="px-5 py-2.5"
        >
          Save
        </Button>
        {student && (
          <div className="flex items-center gap-2">
            {canErase && (
              <Button type="button" variant="danger" size="sm" onClick={erase} disabled={pending}>
                Erase all data
              </Button>
            )}
            <Button type="button" variant="danger" size="sm" onClick={remove} disabled={pending}>
              Delete student
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
