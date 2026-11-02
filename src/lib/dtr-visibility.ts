/**
 * Calendar events a parent should see. An event with no class or group rows is
 * school-wide; a targeted event shows only when one of the parent's children is
 * in a targeted class (dtr_event_classes) or group (dtr_event_groups).
 */
export function eventsForGuardian<E extends { id: string }>(
  events: E[],
  eventClasses: { dtr_event_id: string; class_section_id: string }[],
  eventGroups: { dtr_event_id: string; custom_group_id: string }[],
  classIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
): E[] {
  const targeted = new Set([
    ...eventClasses.map((ec) => ec.dtr_event_id),
    ...eventGroups.map((eg) => eg.dtr_event_id),
  ]);
  const reached = new Set([
    ...eventClasses.filter((ec) => classIds.has(ec.class_section_id)).map((ec) => ec.dtr_event_id),
    ...eventGroups.filter((eg) => groupIds.has(eg.custom_group_id)).map((eg) => eg.dtr_event_id),
  ]);
  return events.filter((e) => !targeted.has(e.id) || reached.has(e.id));
}
