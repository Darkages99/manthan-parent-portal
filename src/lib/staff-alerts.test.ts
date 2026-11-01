import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";
import { alertsForDeactivatedStaff, insertStaffAlerts } from "./staff-alerts";

const S = "staff-1";
const cls = (grade: string, section: string) => ({ grade, section });

describe("alertsForDeactivatedStaff", () => {
  it("raises one alert per class-teacher, subject and timetable assignment", async () => {
    const { client } = fakeSupabase({
      class_sections: [{ class_teacher_id: S, grade: "8", section: "A" }],
      class_subject_teachers: [
        { teacher_id: S, class_section_id: "9A", subject_id: "maths", class_sections: cls("9", "A"), subjects: { name: "Maths" } },
      ],
      timetable_entries: [
        { teacher_id: S, class_section_id: "7B", subject_id: "art", class_sections: cls("7", "B"), subjects: { name: "Art" } },
      ],
    });
    expect(await alertsForDeactivatedStaff(client, S)).toEqual([
      "Grade 8-A needs a new class teacher",
      "Grade 9-A needs a Maths teacher",
      "Grade 7-B timetable needs a Art teacher",
    ]);
  });

  it("does not repeat a class+subject already reported via class_subject_teachers", async () => {
    const dup = { teacher_id: S, class_section_id: "9A", subject_id: "maths", class_sections: cls("9", "A"), subjects: { name: "Maths" } };
    const { client } = fakeSupabase({
      class_subject_teachers: [dup, dup],
      timetable_entries: [dup, dup],
    });
    expect(await alertsForDeactivatedStaff(client, S)).toEqual(["Grade 9-A needs a Maths teacher"]);
  });

  it("skips timetable cells with no subject and rows missing their joins", async () => {
    const { client } = fakeSupabase({
      timetable_entries: [
        { teacher_id: S, class_section_id: "1A", subject_id: null, class_sections: cls("1", "A"), subjects: null },
        { teacher_id: S, class_section_id: "1B", subject_id: "x", class_sections: null, subjects: { name: "X" } },
      ],
    });
    expect(await alertsForDeactivatedStaff(client, S)).toEqual([]);
  });

  it("ignores other staff members' assignments", async () => {
    const { client } = fakeSupabase({
      class_sections: [{ class_teacher_id: "someone-else", grade: "5", section: "C" }],
    });
    expect(await alertsForDeactivatedStaff(client, S)).toEqual([]);
  });
});

describe("insertStaffAlerts", () => {
  it("inserts one row per message for the staff member", async () => {
    const { client, writes } = fakeSupabase({});
    await insertStaffAlerts(client, S, ["a", "b"]);
    expect(writes).toEqual([
      { table: "staff_reassignment_alerts", kind: "insert", payload: [{ staff_id: S, message: "a" }, { staff_id: S, message: "b" }] },
    ]);
  });

  it("surfaces a database error", async () => {
    const { client } = fakeSupabase({}, { error: "rls denied" });
    await expect(insertStaffAlerts(client, S, ["a"])).rejects.toThrow("rls denied");
  });
});
