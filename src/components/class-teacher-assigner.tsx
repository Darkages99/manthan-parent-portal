"use client";

import { useState, useTransition } from "react";
import { assignClassTeacher } from "@/app/(staff)/console/classes/actions";
import { ComboBox } from "./combobox";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type StaffLite = { id: string; name: string; role: Tables<"staff">["role"] };

const ROLE_LABEL: Record<string, string> = {
  class_teacher: "Class teacher",
  principal: "Principal",
  front_office: "Front office",
  accounts: "Accounts",
  super_admin: "Admin",
  parent: "Parent",
};

export function ClassTeacherAssigner({
  classes,
  staff,
}: {
  classes: ClassSection[];
  staff: StaffLite[];
}) {
  if (classes.length === 0) {
    return <p className="text-base text-slate">No classes have been set up yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full text-left">
        <thead className="bg-maroon text-cream">
          <tr>
            <th className="px-5 py-3 font-heading text-base font-normal">Class</th>
            <th className="px-5 py-3 font-heading text-base font-normal">Class teacher</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {classes.map((c) => (
            <ClassRow key={c.id} cls={c} staff={staff} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassRow({ cls, staff }: { cls: ClassSection; staff: StaffLite[] }) {
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
      } catch (e) {
        setValue(previous);
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <tr>
      <td className="px-5 py-3 text-base font-semibold text-maroon">
        Grade {cls.grade}-{cls.section}
        <span className="ml-2 text-sm font-normal text-slate">{cls.academic_year}</span>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-full max-w-xs">
            <ComboBox
              options={staff.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: ROLE_LABEL[s.role] ?? s.role,
              }))}
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
      </td>
    </tr>
  );
}
