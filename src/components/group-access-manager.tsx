"use client";

import { useState, useTransition } from "react";
import { setGroupStaffAccess } from "@/app/(staff)/console/messages/compose/actions";

type Group = { id: string; name: string };
type Teacher = { id: string; name: string };

/**
 * Principal-only control: assign teachers to a custom group so they can send
 * to it even though they didn't create it themselves (e.g. a cross-class
 * competition group). See setGroupStaffAccess / requireTeacherScope.
 */
export function GroupAccessManager({
  groups,
  teachers,
  initialAccess,
}: {
  groups: Group[];
  teachers: Teacher[];
  /** Set of "groupId:staffId" keys the teacher already has access to. */
  initialAccess: Set<string>;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [, startTransition] = useTransition();

  if (groups.length === 0 || teachers.length === 0) return null;

  function toggle(groupId: string, staffId: string) {
    const key = `${groupId}:${staffId}`;
    const next = !access.has(key);
    setAccess((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
    startTransition(async () => {
      try {
        await setGroupStaffAccess(groupId, staffId, next);
      } catch {
        setAccess((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(key);
          else copy.add(key);
          return copy;
        });
      }
    });
  }

  return (
    <details className="rounded-sm border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <summary className="cursor-pointer font-heading text-lg text-maroon">
        Assign teachers to custom groups
      </summary>
      <p className="mt-2 text-sm text-slate-strong">
        Teachers can only message their own classes/students unless assigned to a group here.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline">
              <th className="p-2 text-sm font-semibold text-slate">Group</th>
              {teachers.map((t) => (
                <th key={t.id} className="p-2 text-center text-sm font-semibold text-slate">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-b border-hairline last:border-0">
                <td className="p-2 text-sm font-medium text-maroon">{g.name}</td>
                {teachers.map((t) => (
                  <td key={t.id} className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={access.has(`${g.id}:${t.id}`)}
                      onChange={() => toggle(g.id, t.id)}
                      className="h-4 w-4 accent-rust"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
