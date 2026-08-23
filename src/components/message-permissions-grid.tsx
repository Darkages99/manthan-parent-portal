"use client";

import { useState, useTransition } from "react";
import { updateSendPermission } from "@/app/(staff)/console/messages/permissions/actions";
import { roleLabel } from "@/lib/role-labels";
import type { Enums } from "@/lib/supabase/database.types";

type Role = Enums<"role">;
type ScopeType = Enums<"message_scope_type">;

const ROLES: Role[] = [
  "parent",
  "class_teacher",
  "front_office",
  "accounts",
  "principal",
  "super_admin",
  "coordinator",
];
const SCOPES: { value: ScopeType; label: string }[] = [
  { value: "school", label: "Whole school" },
  { value: "class", label: "Class" },
  { value: "student", label: "Individual student" },
  { value: "group", label: "Custom group" },
];

function key(role: Role, scope: ScopeType) {
  return `${role}:${scope}`;
}

export function MessagePermissionsGrid({
  permissions,
}: {
  permissions: { role: Role; scope_type: ScopeType; allowed: boolean }[];
}) {
  const [, startTransition] = useTransition();
  // Optimistic overrides on top of the server-fetched permissions, so a click
  // flips the checkbox immediately instead of waiting for revalidation.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function isAllowed(role: Role, scope: ScopeType) {
    const k = key(role, scope);
    if (k in overrides) return overrides[k];
    return permissions.find((p) => p.role === role && p.scope_type === scope)?.allowed ?? false;
  }

  function toggle(role: Role, scope: ScopeType, next: boolean) {
    const k = key(role, scope);
    setOverrides((prev) => ({ ...prev, [k]: next }));
    startTransition(async () => {
      try {
        await updateSendPermission(role, scope, next);
      } catch {
        setOverrides((prev) => ({ ...prev, [k]: !next }));
      }
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
              <td className="p-4 text-base font-semibold text-maroon">{roleLabel(role)}</td>
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
