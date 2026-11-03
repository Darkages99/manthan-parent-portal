"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCalendarEvent } from "@/app/(staff)/console/calendar/actions";
import { DtrFilterView } from "./dtr-filter-view";
import { CalendarEventForm } from "./calendar-event-form";
import { Dialog } from "./dialog";
import { CreateFab } from "./create-fab";
import { useToast } from "./toast-provider";
import type { Tables } from "@/lib/supabase/database.types";

type Event = Tables<"dtr_events">;
type GroupOption = { id: string; name: string };

/** Staff calendar: the shared calendar view plus add / edit / delete. */
export function CalendarManager({
  events,
  audienceById,
  editableIds,
  classSections,
  groups,
  canAddSchoolWide,
}: {
  events: Event[];
  /** "Whole school" or the class/group names an event is for. */
  audienceById: Record<string, string>;
  /** Events this viewer may edit or delete (their own, or all for leadership). */
  editableIds: string[];
  classSections: Tables<"class_sections">[];
  groups: GroupOption[];
  canAddSchoolWide: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const editable = new Set(editableIds);

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCalendarEvent(confirmDelete.id);
      toast.success("Event deleted");
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DtrFilterView
        events={events}
        eventNote={(e) => audienceById[e.id] ?? null}
        renderEventActions={(e) =>
          editable.has(e.id) ? (
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(e)}
                className="rounded-sm border border-hairline bg-surface px-2.5 py-1 text-sm font-semibold text-maroon hover:bg-mist"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(e)}
                className="rounded-sm border border-hairline bg-surface px-2.5 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30"
              >
                Delete
              </button>
            </div>
          ) : null
        }
      />

      <CreateFab label="Add calendar event" onClick={() => setAdding(true)} />

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add calendar event">
        {adding && (
          <CalendarEventForm
            classSections={classSections}
            groups={groups}
            canAddSchoolWide={canAddSchoolWide}
            onDone={() => setAdding(false)}
          />
        )}
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Edit calendar event">
        {editing && (
          <CalendarEventForm
            key={editing.id}
            classSections={classSections}
            groups={groups}
            canAddSchoolWide={canAddSchoolWide}
            event={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Delete event?">
        {confirmDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-base text-slate-strong">
              &ldquo;{confirmDelete.title}&rdquo; will be removed from the calendar for everyone who can see it.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting}
                className="rounded-sm bg-rose-700 px-4 py-2 text-base font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-sm border border-hairline bg-surface px-4 py-2 text-base font-semibold text-slate-strong hover:bg-mist"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
