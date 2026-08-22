"use client";

import { useTransition } from "react";
import { updateSendPermission } from "@/app/(staff)/console/messages/permissions/actions";
import type { Enums } from "@/lib/supabase/database.types";

type Role = Enums<"role">;
type ScopeType = Enums<"message_scope_type">;

const ROLES: Role[] = ["parent", "class_teacher", "front_office", "accounts", "principal", "super_admin", "coordinator"];
const SCOPES: { value: ScopeType; label: string }[] = [
  { value: "school", label: "Whole school" },
  { value: "class", label: "Class" },
  { value: "student", label: "Individual student" },
  { value: "group", label: "Custom group" },
];

export function MessagePermissionsGrid({
  permissions,
}: {
  permissions: { role: Role; scope_type: ScopeType; allowed: boolean }[];
}) {
  const [, startTransition] = useTransition();

  function isAllowed(role: Role, scope: ScopeType) {
    return permissions.find((p) => p.role === role && p.scope_type === scope)?.allowed ?? false;
  }

  function toggle(role: Role, scope: ScopeType, next: boolean) {
    startTransition(() => {
      updateSendPermission(role, scope, next).catch(() => {});
    });
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[600px] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline">
            <th className="p-4 font-heading text-sm uppercase tracking-wide text-slate">Role</th>
            {SCOPES.map((s) => (
              <th key={s.value} className="p-4 text-center font-heading text-sm uppercase tracking-wide text-slate">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => (
            <tr key={role} className="border-b border-hairline last:border-0">
              <td className="p-4 text-base font-semibold capitalize text-maroon">{role.replace("_", " ")}</td>
              {SCOPES.map((s) => {
                const checked = isAllowed(role, s.value);
                return (
                  <td key={s.value} className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggle(role, s.value, e.target.checked)}
                      className="h-5 w-5 accent-rust"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
