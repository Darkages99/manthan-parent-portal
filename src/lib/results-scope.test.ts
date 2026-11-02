import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";

const getViewer = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  assertCanEditGradeConfig,
  assertCanEditMark,
  assertCanManageReportCard,
  canEditSubject,
  getEditableSubjects,
  getEditableSubjectsByClass,
} from "./results-scope";

/**
 * Fixture: teacher T owns 8A (homeroom), teaches Maths in 9A via the timetable
 * and Science in 9A via class_subject_teachers, and Art in 7B (no homeroom there).
 * Student s-8a is in 8A, s-9a in 9A, s-7b in 7B. In 6C T only has a free period (no
 * subject): they "teach" the class for viewing, but own no subject there. 4D is unrelated.
 */
const T = "teacher-1";
const db = () => ({
  class_sections: [
    { id: "8A", class_teacher_id: T },
    { id: "9A", class_teacher_id: "someone-else" },
  ],
  timetable_entries: [
    { class_section_id: "9A", subject_id: "maths", teacher_id: T },
    { class_section_id: "7B", subject_id: "art", teacher_id: T },
    { class_section_id: "9A", subject_id: "english", teacher_id: "someone-else" },
    { class_section_id: "6C", subject_id: null, teacher_id: T }, // free period, no subject
  ],
  class_subject_teachers: [
    { class_section_id: "9A", subject_id: "science", teacher_id: T },
    { class_section_id: "8A", subject_id: "maths", teacher_id: T }, // already homeroom → still "all"
    { class_section_id: "5X", subject_id: "ghost", teacher_id: T }, // subject row missing
  ],
  subjects: [
    { id: "maths", name: "Maths" },
    { id: "science", name: "Science" },
    { id: "art", name: "Art" },
    { id: "english", name: "English" },
  ],
  students: [
    { id: "s-8a", class_section_id: "8A" },
    { id: "s-9a", class_section_id: "9A" },
    { id: "s-7b", class_section_id: "7B" },
    { id: "s-6c", class_section_id: "6C" },
    { id: "s-4d", class_section_id: "4D" }, // no relationship to T at all
  ],
});

const asStaff = (role: string, id = T) => getViewer.mockResolvedValue({ type: "staff", staff: { id, role } });

beforeEach(() => {
  getViewer.mockReset();
  createClient.mockReset();
  createClient.mockResolvedValue(fakeSupabase(db()).client);
});

describe("getEditableSubjectsByClass", () => {
  it("homeroom grants every subject; subject-only classes grant just their subjects", async () => {
    const map = await getEditableSubjectsByClass(fakeSupabase(db()).client, T);
    expect(map.get("8A")).toBe("all");
    expect(map.get("9A")).toEqual(new Set(["Maths", "Science"]));
    expect(map.get("7B")).toEqual(new Set(["Art"]));
  });

  it("never downgrades a homeroom to a subject list", async () => {
    const map = await getEditableSubjectsByClass(fakeSupabase(db()).client, T);
    expect(map.get("8A")).toBe("all");
  });

  it("ignores rows with no subject or an unknown subject id, and other teachers' rows", async () => {
    const map = await getEditableSubjectsByClass(fakeSupabase(db()).client, T);
    expect(map.has("6C")).toBe(false);
    expect(map.has("5X")).toBe(false);
    expect(map.get("9A")).toEqual(new Set(["Maths", "Science"])); // not English (another teacher's)
  });

  it("is empty for a teacher with no assignments", async () => {
    expect((await getEditableSubjectsByClass(fakeSupabase(db()).client, "nobody")).size).toBe(0);
  });
});

describe("canEditSubject", () => {
  it("no scope → no; 'all' → yes; set → membership", () => {
    expect(canEditSubject(undefined, "Maths")).toBe(false);
    expect(canEditSubject("all", "anything")).toBe(true);
    expect(canEditSubject(new Set(["Maths"]), "Maths")).toBe(true);
    expect(canEditSubject(new Set(["Maths"]), "Art")).toBe(false);
  });
});

describe("getEditableSubjects", () => {
  it("is 'all' when the teacher owns any homeroom", async () => {
    expect(await getEditableSubjects(fakeSupabase(db()).client, T)).toBe("all");
  });

  it("is the union of subjects across classes otherwise", async () => {
    const data = db();
    data.class_sections = [];
    const scope = await getEditableSubjects(fakeSupabase(data).client, T);
    expect(scope).toEqual(new Set(["Maths", "Science", "Art"]));
  });

  it("is an empty set for an unassigned teacher", async () => {
    expect(await getEditableSubjects(fakeSupabase(db()).client, "nobody")).toEqual(new Set());
  });
});

describe("assertCanEditMark", () => {
  it.each(["principal", "super_admin", "coordinator"])("%s passes without any class check", async (role) => {
    asStaff(role, "p1");
    await expect(assertCanEditMark("s-6c", "Anything")).resolves.toBeDefined();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["front_office", "janitor"])("%s is refused", async (role) => {
    asStaff(role);
    await expect(assertCanEditMark("s-8a", "Maths")).rejects.toThrow("Not authorized to enter marks");
  });

  it("signed-out and parent viewers are refused", async () => {
    getViewer.mockResolvedValue(null);
    await expect(assertCanEditMark("s-8a", "Maths")).rejects.toThrow("Not signed in as staff");
    getViewer.mockResolvedValue({ type: "parent" });
    await expect(assertCanEditMark("s-8a", "Maths")).rejects.toThrow("Not signed in as staff");
  });

  describe("class_teacher", () => {
    beforeEach(() => asStaff("class_teacher"));

    it("may enter any subject for their own homeroom", async () => {
      await expect(assertCanEditMark("s-8a", "Hindi")).resolves.toBeDefined();
    });

    it("may enter only their own subject in a class they subject-teach", async () => {
      await expect(assertCanEditMark("s-9a", "Maths")).resolves.toBeDefined();
      await expect(assertCanEditMark("s-9a", "Science")).resolves.toBeDefined();
      await expect(assertCanEditMark("s-9a", "English")).rejects.toThrow(/permission to enter English marks/);
    });

    it("may not enter marks for a class they do not teach", async () => {
      await expect(assertCanEditMark("s-4d", "Maths")).rejects.toThrow(/permission to enter Maths marks/);
    });

    it("a free-period timetable row grants no subject, so no marks entry", async () => {
      await expect(assertCanEditMark("s-6c", "Maths")).rejects.toThrow(/permission to enter Maths marks/);
    });

    it("rejects an unknown student", async () => {
      await expect(assertCanEditMark("nope", "Maths")).rejects.toThrow("Student not found");
    });
  });
});

describe("assertCanEditGradeConfig", () => {
  it("principal-tier passes", async () => {
    asStaff("principal", "p1");
    await expect(assertCanEditGradeConfig("Anything")).resolves.toBeDefined();
  });

  it("a class teacher needs the subject somewhere in their scope", async () => {
    asStaff("class_teacher");
    // T owns a homeroom, so 'all' — any subject is allowed.
    await expect(assertCanEditGradeConfig("Hindi")).resolves.toBeDefined();
  });

  it("a subject-only teacher is limited to their subjects", async () => {
    const data = db();
    data.class_sections = [];
    createClient.mockResolvedValue(fakeSupabase(data).client);
    asStaff("class_teacher");
    await expect(assertCanEditGradeConfig("Maths")).resolves.toBeDefined();
    await expect(assertCanEditGradeConfig("English")).rejects.toThrow(/permission to configure English grading/);
  });

  it("other roles are refused", async () => {
    asStaff("front_office");
    await expect(assertCanEditGradeConfig("Maths")).rejects.toThrow("Not authorized to configure grading");
  });
});

describe("assertCanManageReportCard", () => {
  it.each(["principal", "super_admin", "coordinator", "front_office"])("%s passes", async (role) => {
    asStaff(role, "x");
    await expect(assertCanManageReportCard("s-6c")).resolves.toBeDefined();
  });

  it("a class teacher passes for any class they teach (homeroom or subject), not others", async () => {
    asStaff("class_teacher");
    await expect(assertCanManageReportCard("s-8a")).resolves.toBeDefined();
    await expect(assertCanManageReportCard("s-9a")).resolves.toBeDefined();
    await expect(assertCanManageReportCard("s-4d")).rejects.toThrow("Not authorized to manage this student");
  });

  it("a timetable row of any kind (even a free period) counts as teaching the class for report cards", async () => {
    asStaff("class_teacher");
    await expect(assertCanManageReportCard("s-6c")).resolves.toBeDefined();
  });

  it("an unknown role is refused", async () => {
    asStaff("janitor");
    await expect(assertCanManageReportCard("s-8a")).rejects.toThrow("Not authorized to manage report cards");
  });

  it("rejects an unknown student for a class teacher", async () => {
    asStaff("class_teacher");
    await expect(assertCanManageReportCard("nope")).rejects.toThrow("Student not found");
  });
});
