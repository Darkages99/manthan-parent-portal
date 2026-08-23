"use client";

import { useState, useTransition } from "react";
import {
  createGroup,
  renameGroup,
  deleteGroup,
  setGroupMembers,
} from "@/app/(staff)/console/messages/groups/actions";
import { setGroupStaffAccess } from "@/app/(staff)/console/messages/compose/actions";
import { TypeaheadPicker, type TypeaheadOption } from "./typeahead-picker";
import { MemberScrollList } from "./member-scroll-list";
import { ChevronDownIcon } from "./icons";
import { useToast } from "./toast-provider";

type Group = { id: string; name: string };

export function CustomGroupManager({
  groups,
  members,
  students,
  teachers,
  access,
}: {
  groups: Group[];
  members: Record<string, string[]>;
  students: TypeaheadOption[];
  teachers: TypeaheadOption[];
  access: Record<string, string[]>;
}) {
  const toast = useToast();
  const [localGroups, setLocalGroups] = useState(groups);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!newName.trim()) return;
    setError(null);
    const name = newName.trim();
    startTransition(async () => {
      try {
        const id = await createGroup(name);
        setLocalGroups((g) => [...g, { id, name }]);
        setNewName("");
        toast.success("Group created");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create group");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this group? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteGroup(id);
        setLocalGroups((g) => g.filter((x) => x.id !== id));
        toast.success("Group deleted");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete group");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-hairline bg-mist/40 p-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New group name"
          className="flex-1 rounded-sm border border-hairline bg-surface px-3 py-2 text-base"
        />
        <button
          type="button"
          onClick={add}
          disabled={isPending || !newName.trim()}
          className="rounded-sm bg-maroon px-4 py-2 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          Create group
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <ul className="flex flex-col gap-4">
        {localGroups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            students={students}
            teachers={teachers}
            initialMembers={members[g.id] ?? []}
            initialAccess={access[g.id] ?? []}
            onDelete={() => remove(g.id)}
          />
        ))}
        {localGroups.length === 0 && <p className="text-base text-slate">No custom groups yet.</p>}
      </ul>
    </div>
  );
}

function GroupCard({
  group,
  students,
  teachers,
  initialMembers,
  initialAccess,
  onDelete,
}: {
  group: Group;
  students: TypeaheadOption[];
  teachers: TypeaheadOption[];
  initialMembers: string[];
  initialAccess: string[];
  onDelete: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(group.name);
  const [editingName, setEditingName] = useState(false);
  const [memberIds, setMemberIds] = useState(initialMembers);
  const [accessIds, setAccessIds] = useState(initialAccess);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const studentLabelById = new Map(students.map((s) => [s.id, s.label]));

  function saveName() {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      setName(group.name);
      return;
    }
    startTransition(async () => {
      try {
        await renameGroup(group.id, trimmed);
        toast.success("Renamed");
      } catch {
        setName(group.name);
      }
    });
  }

  function onMembersChange(next: string[]) {
    const previous = memberIds;
    setMemberIds(next);
    startTransition(async () => {
      try {
        await setGroupMembers(group.id, next);
        toast.success("Members updated");
      } catch {
        setMemberIds(previous);
      }
    });
  }

  function onAccessChange(next: string[]) {
    const previous = accessIds;
    const added = next.filter((id) => !previous.includes(id));
    const removed = previous.filter((id) => !next.includes(id));
    setAccessIds(next);
    startTransition(async () => {
      try {
        await Promise.all([
          ...added.map((id) => setGroupStaffAccess(group.id, id, true)),
          ...removed.map((id) => setGroupStaffAccess(group.id, id, false)),
        ]);
        toast.success("Access updated");
      } catch {
        setAccessIds(previous);
      }
    });
  }

  return (
    <li className="rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-slate transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              onClick={(e) => e.stopPropagation()}
              className="rounded-sm border border-hairline bg-mist px-2 py-1 text-lg font-semibold text-maroon"
            />
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setEditingName(true);
              }}
              className="truncate font-heading text-lg text-maroon hover:underline"
            >
              {group.name}
            </span>
          )}
          <span className="shrink-0 text-sm text-slate">{memberIds.length} student{memberIds.length === 1 ? "" : "s"}</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-hairline p-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate">Members</p>
            <TypeaheadPicker
              options={students}
              selected={memberIds}
              onChange={onMembersChange}
              placeholder="Add a student…"
              hideChips
            />
            <div className="mt-2">
              <MemberScrollList
                items={memberIds.map((id) => ({ id, label: studentLabelById.get(id) ?? id }))}
                onRemove={(id) => onMembersChange(memberIds.filter((m) => m !== id))}
                emptyLabel="No students in this group yet."
              />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate">
              Teachers with access
            </p>
            <TypeaheadPicker
              options={teachers}
              selected={accessIds}
              onChange={onAccessChange}
              placeholder="Add a teacher…"
            />
          </div>
        </div>
      )}
    </li>
  );
}
