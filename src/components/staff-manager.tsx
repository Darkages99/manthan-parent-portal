"use client";

import { useState, useTransition } from "react";
import { createStaffAccount, updateStaffRole, setStaffActive } from "@/app/(staff)/console/staff/actions";
import { ROLE_LABELS, roleLabel } from "@/lib/role-labels";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Toolbar, SearchInput, SegmentedControl } from "./filter-bar";
import { PlusIcon } from "./icons";
import { useToast } from "./toast-provider";
import type { Enums, Tables } from "@/lib/supabase/database.types";

const SELECT_PILL =
  "rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm text-slate-strong shadow-[var(--shadow-card)] transition-colors focus:border-rust/60";

type StaffRow = Tables<"staff">;
// "admin" is a retired role (PTM approval now uses front_office) — excluded
// so it can't be assigned to new or existing staff from this picker.
const ROLE_OPTIONS: Enums<"role">[] = (Object.keys(ROLE_LABELS) as Enums<"role">[]).filter(
  (r) => r !== "admin"
);

export function StaffManager({ staff }: { staff: StaffRow[] }) {
  const [list, setList] = useState(staff);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Enums<"role"> | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = list.filter((s) => {
    if (roleFilter !== "all" && s.role !== roleFilter) return false;
    if (statusFilter === "active" && !s.active) return false;
    if (statusFilter === "inactive" && s.active) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.username, s.phone, s.email].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Name, username, phone, email…"
          ariaLabel="Search staff"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Enums<"role"> | "all")}
          aria-label="Filter by role"
          className={SELECT_PILL}
        >
          <option value="all">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
        <SegmentedControl<"all" | "active" | "inactive">
          ariaLabel="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Deactivated" },
          ]}
        />
        <Button
          className="ml-auto shrink-0"
          size="sm"
          onClick={() => setAddOpen(true)}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Add staff
        </Button>
      </Toolbar>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add staff">
        <CreateStaffForm
          onCreated={(row) => setList((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      </Dialog>

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
            {filtered.map((s) => (
              <StaffRow key={s.id} staff={s} onChange={(next) => setList((prev) => prev.map((p) => (p.id === next.id ? next : p)))} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-base text-slate">
                  No staff match this search.
                </td>
              </tr>
            )}
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
          {(ROLE_OPTIONS.includes(staff.role) ? ROLE_OPTIONS : [staff.role, ...ROLE_OPTIONS]).map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-5 py-3 text-sm text-slate-strong">
        <div>@{staff.username}</div>
        {staff.phone && <div className="text-slate">{staff.phone}</div>}
        {staff.email && <div className="text-slate">{staff.email}</div>}
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Enums<"role">>("class_teacher");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; email: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setCreated(null);
    startTransition(async () => {
      try {
        await createStaffAccount({ name, username, password, phone, email, role });
        onCreated({
          id: crypto.randomUUID(),
          auth_user_id: null,
          name,
          username: username.trim().toLowerCase(),
          phone: phone || null,
          email: email || null,
          role,
          active: true,
          created_at: new Date().toISOString(),
        });
        setCreated({ username: username.trim().toLowerCase(), email });
        setName("");
        setUsername("");
        setPassword("");
        setPhone("");
        setEmail("");
        toast.celebrate("Staff account created");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create account");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="letters, numbers, dots, dashes"
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Password</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set their sign-in password"
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Phone (optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
          {!phone && (
            <span className="text-sm text-slate">Without a phone, they can&apos;t use OTP sign-in or recovery.</span>
          )}
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Email (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
          {!email && <span className="text-sm text-slate">Without an email, they can&apos;t sign in with Google.</span>}
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
      </div>
      <Button
        onClick={submit}
        loading={isPending}
        disabled={!name || !username || !password}
        icon={<PlusIcon className="h-5 w-5" />}
        className="mt-4 px-5 py-2.5"
      >
        Create account
      </Button>
      {error && <p className="mt-3 text-base text-rose-700">{error}</p>}
      {created && (
        <p className="mt-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200">
          Account created. They sign in with username <strong>{created.username}</strong>
          {created.email && (
            <>
              {" "}
              (or email <strong>{created.email}</strong>)
            </>
          )}{" "}
          and the password you set.
        </p>
      )}
    </div>
  );
}
