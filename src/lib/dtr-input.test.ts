import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX, TITLE_MAX, parseEventFields, type EventFields } from "./dtr-input";

const valid: EventFields = {
  title: "  Sports day ",
  eventDate: "2026-12-05",
  category: "event",
  description: "  Bring water  ",
};

describe("parseEventFields", () => {
  it("trims title and description", () => {
    expect(parseEventFields(valid)).toEqual({
      title: "Sports day",
      eventDate: "2026-12-05",
      category: "event",
      description: "Bring water",
    });
  });

  it("turns a blank description into null", () => {
    expect(parseEventFields({ ...valid, description: "   " }).description).toBeNull();
  });

  it("requires a title", () => {
    expect(() => parseEventFields({ ...valid, title: "   " })).toThrow("title");
  });

  it("caps title and description length", () => {
    expect(() => parseEventFields({ ...valid, title: "x".repeat(TITLE_MAX) })).not.toThrow();
    expect(() => parseEventFields({ ...valid, title: "x".repeat(TITLE_MAX + 1) })).toThrow("title");
    expect(() => parseEventFields({ ...valid, description: "x".repeat(DESCRIPTION_MAX + 1) })).toThrow(
      "description"
    );
  });

  it.each(["", "05-12-2026", "2026-2-5", "2026-02-30", "2026-13-01", "2026-12-05T00:00"])(
    "rejects date %j",
    (eventDate) => {
      expect(() => parseEventFields({ ...valid, eventDate })).toThrow("valid date");
    }
  );

  it("accepts a leap day", () => {
    expect(parseEventFields({ ...valid, eventDate: "2028-02-29" }).eventDate).toBe("2028-02-29");
  });

  it("rejects an unknown category", () => {
    expect(() =>
      parseEventFields({ ...valid, category: "party" as EventFields["category"] })
    ).toThrow("category");
  });
});
