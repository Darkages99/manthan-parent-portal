import { describe, expect, it } from "vitest";
import { ROLE_LABELS, roleLabel } from "./role-labels";
import { PENDING_DELETION_SUBJECT_LABEL, pendingDeletionLabel } from "./pending-deletion-label";
import { EASE_OUT_EXPO, fadeUp, staggerContainer } from "./motion";
import { TRANSPORT_PARENT_ARRANGED, TRANSPORT_SELF_RETURN } from "./stay-back-transport";
import { countAlerts } from "./console-alert-count";

describe("roleLabel", () => {
  it("labels every role, showing class_teacher as Teacher", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(
      ["class_teacher", "coordinator", "front_office", "principal", "super_admin"],
    );
    expect(roleLabel("class_teacher")).toBe("Teacher");
    expect(roleLabel("super_admin")).toBe("Super admin");
  });

  it("falls back to the raw value for an unknown role", () => {
    expect(roleLabel("janitor" as never)).toBe("janitor");
  });
});

describe("pendingDeletionLabel", () => {
  it("prefers the person's full name", () => {
    expect(pendingDeletionLabel("id1", { first_name: "Asha", last_name: "Kumar" })).toBe("Asha Kumar");
    expect(pendingDeletionLabel("id1", { first_name: "Asha" })).toBe("Asha");
    expect(pendingDeletionLabel("id1", { first_name: "", last_name: "" })).toBe("id1");
  });

  it("uses name, then grade-section, then the id", () => {
    expect(pendingDeletionLabel("id1", { name: "Maths" })).toBe("Maths");
    expect(pendingDeletionLabel("id1", { grade: "8", section: "A" })).toBe("Grade 8 - A");
    expect(pendingDeletionLabel("id1", { grade: "8" })).toBe("id1");
    expect(pendingDeletionLabel("id1", {})).toBe("id1");
  });

  it("tolerates a missing snapshot", () => {
    expect(pendingDeletionLabel("id1", null)).toBe("id1");
    expect(pendingDeletionLabel("id1", undefined)).toBe("id1");
  });

  it("has a label for every synced subject", () => {
    expect(Object.keys(PENDING_DELETION_SUBJECT_LABEL).sort()).toEqual(
      ["class_sections", "guardians", "staff", "students", "subjects", "timetable_entries"],
    );
  });
});

describe("motion helpers", () => {
  it("expose stable easing and variants", () => {
    expect(EASE_OUT_EXPO).toEqual([0.16, 1, 0.3, 1]);
    expect(fadeUp.hidden.opacity).toBe(0);
    expect(fadeUp.show).toEqual({ opacity: 1, y: 0 });
  });

  it("staggerContainer defaults to 60 ms and accepts an override", () => {
    expect(staggerContainer().show.transition.staggerChildren).toBe(0.06);
    expect(staggerContainer(0.2).show.transition.staggerChildren).toBe(0.2);
  });
});

describe("stay-back transport options", () => {
  it("are the two stored values the form, action and page share", () => {
    expect(TRANSPORT_PARENT_ARRANGED).toBe("Parent-arranged");
    expect(TRANSPORT_SELF_RETURN).toBe("Self-return");
  });
});

describe("countAlerts", () => {
  const empty = {
    lowAttendance: [], pendingLeave: [], pendingStayBack: [], absentToday: [],
    lowScores: [], onLeaveToday: [], dueHomeworkToday: [], stayingBackToday: [],
  };
  const row = { id: "x", name: "n", className: "c", reason: "r" };

  it("counts the absent and staying-back panels as one row each, plus every staff alert", () => {
    expect(countAlerts(empty)).toBe(0);
    expect(countAlerts({ ...empty, absentToday: [row, row, row] })).toBe(1);
    expect(countAlerts({ ...empty, absentToday: [row], stayingBackToday: [{ ...row, fromTime: "", toTime: "" }] })).toBe(2);
    expect(countAlerts(empty, [{ id: "a" }, { id: "b" }] as never)).toBe(2);
  });
});
