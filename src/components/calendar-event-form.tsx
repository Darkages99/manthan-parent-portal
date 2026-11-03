"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/app/(staff)/console/calendar/actions";
import { DTR_CATEGORIES, categoryLabel, type DTRCategory } from "@/lib/dtr";
import { toISODate } from "@/lib/calendar";
import { TypeaheadPicker, type TypeaheadOption } from "./typeahead-picker";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Audience = "school" | "targeted";
type GroupOption = { id: string; name: string };

/**
 * Add or edit a calendar event. Adding picks who it is for: leadership may add
 * whole-school events; teachers only their own classes or groups (the server
 * enforces this too). Editing changes the details only, never the audience.
 */
export function CalendarEventForm({
  classSections,
  groups,
  canAddSchoolWide,
  event,
  defaultDate,
  onDone,
}: {
  classSections: Tables<"class_sections">[];
  groups: GroupOption[];
  canAddSchoolWide: boolean;
  /** Present when editing. */
  event?: Tables<"dtr_events">;
  defaultDate?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>(canAddSchoolWide ? "school" : "targeted");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setEventDate] = useState(event?.event_date ?? defaultDate ?? toISODate(new Date()));
  const [category, setCategory] = useState<DTRCategory>(event?.category ?? "event");
  const [description, setDescription] = useState(event?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classOptions: TypeaheadOption[] = useMemo(
    () => classSections.map((c) => ({ id: c.id, label: `Grade ${c.grade} - ${c.section}` })),
    [classSections]
  );
  const groupOptions: TypeaheadOption[] = useMemo(
    () => groups.map((g) => ({ id: g.id, label: g.name })),
    [groups]
  );

  const noTargets = audience === "targeted" && selectedClasses.length + selectedGroups.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!event && noTargets) {
      setError("Pick at least one class or group");
      return;
    }
    setSaving(true);
    try {
      const fields = { title, eventDate, category, description };
      if (event) {
        await updateCalendarEvent(event.id, fields);
        toast.success("Event updated");
      } else {
        await createCalendarEvent({
          ...fields,
          classSectionIds: audience === "targeted" ? selectedClasses : [],
          groupIds: audience === "targeted" ? selectedGroups : [],
        });
        toast.success("Event added to the calendar");
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!event && (
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate">Who is it for?</p>
          {canAddSchoolWide && (
            <div className="flex flex-wrap gap-2">
              {(["school", "targeted"] as Audience[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`rounded-full border px-4 py-1.5 text-base transition ${
                    audience === a ? "border-rust bg-rust text-white" : "border-hairline bg-mist text-slate-strong"
                  }`}
                >
                  {a === "school" ? "Whole school" : "Classes or groups"}
                </button>
              ))}
            </div>
          )}

          {audience === "school" ? (
            <p className="mt-3 rounded-sm border border-hairline bg-mist/50 px-4 py-3 text-base text-slate-strong">
              Every parent and staff member sees this date.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-sm font-medium text-maroon">Classes</p>
                <TypeaheadPicker
                  options={classOptions}
                  selected={selectedClasses}
                  onChange={setSelectedClasses}
                  placeholder="Search classes…"
                />
                {classSections.length === 0 && (
                  <p className="mt-1.5 text-sm text-slate">You don&apos;t teach any classes yet.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-maroon">Groups</p>
                <TypeaheadPicker
                  options={groupOptions}
                  selected={selectedGroups}
                  onChange={setSelectedGroups}
                  placeholder="Search custom groups…"
                />
                {groups.length === 0 && <p className="mt-1.5 text-sm text-slate">No custom groups yet.</p>}
              </div>
              <p className="text-sm text-slate">
                Only parents of students in these classes or groups see the event.
              </p>
            </div>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          placeholder="Annual sports day"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Date</span>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base">
          <span className="font-medium text-maroon">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DTRCategory)}
            className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          >
            {DTR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-base">
        <span className="font-medium text-maroon">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
          placeholder="Optional — timings, what to bring, dress code…"
        />
      </label>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
        >
          {saving ? "Saving…" : event ? "Save changes" : "Add event"}
        </button>
        {error && <span className="ml-3 text-base text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
