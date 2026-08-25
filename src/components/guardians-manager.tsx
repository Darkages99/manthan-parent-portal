"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGuardian, updateGuardian, deleteGuardian } from "@/app/(staff)/console/parents/actions";
import { TypeaheadPicker, type TypeaheadOption } from "./typeahead-picker";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Toolbar, SearchInput } from "./filter-bar";
import { PlusIcon } from "./icons";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Guardian = Tables<"guardians">;

const inputCls = "rounded-sm border border-hairline bg-mist px-3 py-2 text-base";

export function GuardiansManager({
  guardians,
  studentOptions,
  studentLabelById,
  childIdsByGuardian,
}: {
  guardians: Guardian[];
  studentOptions: TypeaheadOption[];
  studentLabelById: Record<string, string>;
  childIdsByGuardian: Record<string, string[]>;
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Guardian | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guardians;
    return guardians.filter((g) => {
      const children = (childIdsByGuardian[g.id] ?? []).map((id) => studentLabelById[id] ?? "").join(" ");
      const haystack = [g.name, g.phone, g.email ?? "", g.relation, children].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [guardians, query, childIdsByGuardian, studentLabelById]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Name, mobile, email, child…"
          ariaLabel="Search parents"
        />
        <Button
          className="ml-auto shrink-0"
          size="sm"
          onClick={() => setAddOpen(true)}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Add parent
        </Button>
      </Toolbar>

      <div className="overflow-x-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-hairline text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Children</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate">
                  No parents match.
                </td>
              </tr>
            )}
            {filtered.map((g) => {
              const children = (childIdsByGuardian[g.id] ?? []).map((id) => studentLabelById[id] ?? "?");
              return (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-medium text-slate-strong">
                    {g.name}
                    <span className="ml-2 text-xs font-normal text-slate">{g.relation}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-strong">{g.phone}</td>
                  <td className="px-4 py-3 text-slate-strong">
                    {g.email ?? "—"}
                    {g.auth_user_id ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Activated
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">
                        Not activated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {children.length ? children.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(g)}
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

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add parent">
        <GuardianForm studentOptions={studentOptions} onDone={() => setAddOpen(false)} />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit parent">
        {editing && (
          <GuardianForm
            studentOptions={studentOptions}
            guardian={editing}
            initialChildIds={childIdsByGuardian[editing.id] ?? []}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function GuardianForm({
  studentOptions,
  guardian,
  initialChildIds = [],
  onDone,
}: {
  studentOptions: TypeaheadOption[];
  guardian?: Guardian;
  initialChildIds?: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(guardian?.name ?? "");
  const [relation, setRelation] = useState(guardian?.relation ?? "Parent");
  const [phone, setPhone] = useState(guardian?.phone ?? "");
  const [email, setEmail] = useState(guardian?.email ?? "");
  const [childIds, setChildIds] = useState<string[]>(initialChildIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const input = { name, relation, phone, email };
        if (guardian) {
          await updateGuardian(guardian.id, input, childIds);
          toast.success("Saved");
        } else {
          await createGuardian(input, childIds);
          toast.success("Parent added");
        }
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!guardian) return;
    if (!confirm(`Delete ${guardian.name}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteGuardian(guardian.id);
        toast.success("Parent deleted");
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
          <span className="font-medium text-maroon">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Relation</span>
          <input
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder="Mother, Father, Guardian…"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Mobile</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Email (Gmail)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@gmail.com"
            className={inputCls}
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Children</span>
        <p className="text-sm text-slate">Search and add as many children as needed.</p>
        <TypeaheadPicker
          options={studentOptions}
          selected={childIds}
          onChange={setChildIds}
          placeholder="Search students…"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={submit}
          loading={pending}
          disabled={!name.trim() || !phone.trim() || !email.trim()}
          className="px-5 py-2.5"
        >
          Save
        </Button>
        {guardian && (
          <Button type="button" variant="danger" size="sm" onClick={remove} disabled={pending}>
            Delete parent
          </Button>
        )}
      </div>
    </div>
  );
}
