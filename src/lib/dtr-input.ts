import { DTR_CATEGORIES, type DTRCategory } from "@/lib/dtr";

export type EventFields = {
  title: string;
  eventDate: string;
  category: DTRCategory;
  description: string;
};

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Trims and checks a calendar event's editable fields. Throws a message fit to
 * show the user. An empty description becomes null.
 */
export function parseEventFields(input: EventFields) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) throw new Error("Give the event a title");
  if (title.length > TITLE_MAX) throw new Error(`Keep the title under ${TITLE_MAX} characters`);
  if (description.length > DESCRIPTION_MAX)
    throw new Error(`Keep the description under ${DESCRIPTION_MAX} characters`);
  if (!isISODate(input.eventDate)) throw new Error("Pick a valid date");
  if (!DTR_CATEGORIES.includes(input.category)) throw new Error("Pick a category");
  return {
    title,
    eventDate: input.eventDate,
    category: input.category,
    description: description || null,
  };
}
