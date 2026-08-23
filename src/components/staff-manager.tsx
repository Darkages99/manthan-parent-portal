"use client";

import { useState, useTransition } from "react";
import { createStaffAccount, updateStaffRole, setStaffActive } from "@/app/(staff)/console/staff/actions";
import { ROLE_LABELS, roleLabel } from "@/lib/role-labels";
import { PlusIcon } from "./icons";
import { useToast } from "./toast-provider";
import type { Enums, Tables } from "@/lib/supabase/database.types";

type StaffRow = Tables<"staff">;
const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as Enums<"role">[];

export function StaffManager({ staff }: { staff: StaffRow[] }) {
  const [list, setList] = useState(staff);

  return (
    <div className="flex flex-col gap-6">
      <CreateStaffForm onCreated={(row) => setList((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))} />

      <div className="overflow-hidden rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-left">
          <thead className="bg-maroon text-cream">
            <tr>
              <th className="px-5 py-3 font-heading text-base font-normal">Name</th>
              <th className="px-5 py-3 font-heading text-base font-normal">Role</th>
              <th className="px-5 py-3 font-heading text-base font-normal">Contact</th>
              <th className="px-5 py-3 font-heading text-base font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {list.map((s) => (
              <StaffRow key={s.id} staff={s} onChange={(next) => setList((prev) => prev.map((p) => (p.id === next.id ? next : p)))} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffRow({ staff, onChange }: { staff: StaffRow; onChange: (next: StaffRow) => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRoleChange(role: Enums<"role">) {
    setError(null);
    startTransition(async () => {
      try {
        await updateStaffRole(staff.id, role);
        onChange({ ...staff, role });
        toast.success("Role updated");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function onToggleActive() {
    setError(null);
    const next = !staff.active;
    startTransition(async () => {
      try {
        await setStaffActive(staff.id, next);
        onChange({ ...staff, active: next });
        toast.success(next ? "Account activated" : "Account deactivated");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <tr>
      <td className="px-5 py-3 text-base font-semibold text-maroon">{staff.name}</td>
      <td className="px-5 py-3">
        <select
          value={staff.role}
          disabled={pending}
          onChange={(e) => onRoleChange(e.target.value as Enums<"role">)}
          className="rounded-sm border border-hairline bg-mist px-3 py-2 text-base text-slate-strong disabled:opacity-60"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-5 py-3 text-sm text-slate-strong">
        <div>{staff.phone}</div>
        <div className="text-slate">{staff.email}</div>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              staff.active
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
            }`}
          >
            {staff.active ? "Active" : "Deactivated"}
          </span>
          <button
            onClick={onToggleActive}
            disabled={pending}
            className="text-sm font-medium text-rust hover:underline disabled:opacity-60"
          >
            {staff.active ? "Deactivate" : "Reactivate"}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function CreateStaffForm({ onCreated }: { onCreated: (row: StaffRow) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Enums<"role">>("class_teacher");
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setCredentials(null);
    startTransition(async () => {
      try {
        const { tempPassword } = await createStaffAccount({ name, phone, email, role });
        onCreated({
          id: crypto.randomUUID(),
          auth_user_id: null,
          name,
          phone,
          email,
          role,
          active: true,
          created_at: new Date().toISOString(),
        });
        setCredentials({ email, password: tempPassword });
        setName("");
        setPhone("");
        setEmail("");
        toast.success("Staff account created");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create account");
      }
    });
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-xl text-maroon">Add staff</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Enums<"role">)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={submit}
          disabled={isPending || !name || !phone || !email}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          <PlusIcon className="h-5 w-5" />
          {isPending ? "Creating…" : "Create account"}
        </button>
      </div>
      {error && <p className="mt-3 text-base text-rose-700">{error}</p>}
      {credentials && (
        <p className="mt-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200">
          Account created for <strong>{credentials.email}</strong>. One-time password:{" "}
          <strong>{credentials.password}</strong> — share this with them; it isn&apos;t shown again.
        </p>
      )}
    </div>
  );
}
