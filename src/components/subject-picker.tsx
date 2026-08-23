"use client";

import { useState } from "react";
import { findOrCreateSubject } from "@/app/(staff)/console/classes/actions";

const CUSTOM_SUBJECT = "__custom__";

/** Subject <select> with an "Other…" option that reveals a text input,
 * creating (or reusing) a subjects row via findOrCreateSubject. Shared by
 * every subject picker in the app (Classes, Homework, ...). */
export function SubjectPicker({
  subjects,
  value,
  onChange,
  disabled,
  className,
}: {
  subjects: { id: string; name: string }[];
  value: string;
  onChange: (subjectId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commitCustom() {
    if (!customName.trim()) {
      setCustomMode(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const id = await findOrCreateSubject(customName.trim());
      onChange(id);
      setCustomMode(false);
      setCustomName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save subject");
    } finally {
      setPending(false);
    }
  }

  const selectCls =
    className ?? "rounded-sm border border-hairline bg-mist px-3 py-2 text-base";

  if (customMode) {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          autoFocus
          value={customName}
          disabled={disabled || pending}
          onChange={(e) => setCustomName(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitCustom();
            }
            if (e.key === "Escape") {
              setCustomMode(false);
              setCustomName("");
            }
          }}
          placeholder="Subject name"
          className={selectCls}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === CUSTOM_SUBJECT) {
          setCustomMode(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={selectCls}
      aria-label="Subject"
    >
      <option value="">— Subject —</option>
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      <option value={CUSTOM_SUBJECT}>Other…</option>
    </select>
  );
}
