"use client";

import { useState, useTransition } from "react";
import {
  createCompetition,
  updateCompetition,
  deleteCompetition,
  type CompetitionInput,
} from "@/app/(staff)/console/competitions/actions";
import { AwardIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type Competition = Tables<"competitions">;

const EMPTY: CompetitionInput = {
  name: "",
  description: "",
  examDate: "",
  registrationDeadline: "",
  externalLink: "",
};

function toInput(c: Competition): CompetitionInput {
  return {
    name: c.name,
    description: c.description ?? "",
    examDate: c.exam_date ?? "",
    registrationDeadline: c.registration_deadline ?? "",
    externalLink: c.external_link ?? "",
  };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CompetitionsConsole({ competitions }: { competitions: Competition[] }) {
  const [items, setItems] = useState(competitions);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-base text-slate">
            No competitions listed yet. Add one below.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {items.map((c) => (
              <CompetitionRow
                key={c.id}
                competition={c}
                onSaved={(updated) =>
                  setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                }
                onDeleted={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
        <button
          type="button"
          onClick={() => setAdding((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
        >
          <span className="font-heading text-xl text-maroon">Add a competition</span>
          <span className="rounded-full bg-maroon px-3 py-1 text-sm font-semibold text-cream">
            {adding ? "Close" : "New"}
          </span>
        </button>
        {adding && (
          <div className="border-t border-hairline px-5 py-4">
            <CompetitionForm
              initial={EMPTY}
              submitLabel="Add competition"
              onSubmit={async (input) => {
                const created = await createCompetition(input);
                setItems((prev) => [...prev, created]);
                setAdding(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitionRow({
  competition,
  onSaved,
  onDeleted,
}: {
  competition: Competition;
  onSaved: (updated: Competition) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Remove "${competition.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCompetition(competition.id);
        onDeleted(competition.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove");
      }
    });
  }

  if (editing) {
    return (
      <li className="px-5 py-4">
        <CompetitionForm
          initial={toInput(competition)}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const updated = await updateCompetition(competition.id, input);
            onSaved(updated);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <AwardIcon className="h-5 w-5 shrink-0 text-rust" />
          <p className="font-heading text-lg text-maroon">{competition.name}</p>
        </div>
        {competition.description && (
          <p className="mt-1 text-base text-slate-strong">{competition.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate">
          {competition.registration_deadline && (
            <span>Registration by <strong className="text-slate-strong">{formatDate(competition.registration_deadline)}</strong></span>
          )}
          {competition.exam_date && (
            <span>Exam on <strong className="text-slate-strong">{formatDate(competition.exam_date)}</strong></span>
          )}
          {competition.external_link && (
            <a
              href={competition.external_link}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rust underline decoration-rust/40 underline-offset-2 hover:decoration-rust"
            >
              More info
            </a>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-slate-strong hover:bg-mist"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function CompetitionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: CompetitionInput;
  submitLabel: string;
  onSubmit: (input: CompetitionInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [input, setInput] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CompetitionInput>(key: K, value: CompetitionInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(input);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-strong">Name</label>
        <input
          value={input.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. National Science Olympiad (NSO)"
          className="w-full rounded-sm border border-hairline bg-mist/30 px-3 py-2 text-base text-slate-strong"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-strong">Description</label>
        <textarea
          value={input.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="Eligibility, syllabus, fees, or any other details for parents"
          className="w-full rounded-sm border border-hairline bg-mist/30 px-3 py-2 text-base text-slate-strong"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-strong">Registration deadline</label>
          <input
            type="date"
            value={input.registrationDeadline}
            onChange={(e) => set("registrationDeadline", e.target.value)}
            className="w-full rounded-sm border border-hairline bg-mist/30 px-3 py-2 text-base text-slate-strong"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-strong">Exam date</label>
          <input
            type="date"
            value={input.examDate}
            onChange={(e) => set("examDate", e.target.value)}
            className="w-full rounded-sm border border-hairline bg-mist/30 px-3 py-2 text-base text-slate-strong"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-strong">External link</label>
        <input
          type="url"
          value={input.externalLink}
          onChange={(e) => set("externalLink", e.target.value)}
          placeholder="https://..."
          className="w-full rounded-sm border border-hairline bg-mist/30 px-3 py-2 text-base text-slate-strong"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !input.name.trim()}
          className="rounded-sm bg-rust px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-sm border border-hairline px-4 py-2 text-sm font-medium text-slate-strong hover:bg-mist"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
