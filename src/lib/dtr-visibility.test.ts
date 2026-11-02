import { describe, expect, it } from "vitest";
import { eventsForGuardian } from "./dtr-visibility";

const events = [{ id: "school" }, { id: "8b" }, { id: "5a" }, { id: "team" }, { id: "chess" }];
const eventClasses = [
  { dtr_event_id: "8b", class_section_id: "class-8b" },
  { dtr_event_id: "5a", class_section_id: "class-5a" },
];
const eventGroups = [
  { dtr_event_id: "team", custom_group_id: "group-team" },
  { dtr_event_id: "chess", custom_group_id: "group-chess" },
];
const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe("eventsForGuardian", () => {
  it("shows school-wide events plus those for the child's class and groups", () => {
    const visible = eventsForGuardian(events, eventClasses, eventGroups, new Set(["class-8b"]), new Set(["group-team"]));
    expect(ids(visible)).toEqual(["school", "8b", "team"]);
  });

  it("hides group events from a parent whose child is in the class but not the group", () => {
    const visible = eventsForGuardian(events, eventClasses, eventGroups, new Set(["class-8b"]), new Set());
    expect(ids(visible)).toEqual(["school", "8b"]);
  });
});
