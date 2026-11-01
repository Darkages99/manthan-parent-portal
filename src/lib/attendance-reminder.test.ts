import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { shouldRemindAttendance } from "./attendance-reminder";

const MONDAY = "2026-11-02T10:00:00Z"; // 15:30 IST
const SUNDAY = "2026-11-01T10:00:00Z";
const TODAY = "2026-11-02";
const teacher = { id: "T", role: "class_teacher" } as never;

const base = () => ({
  class_sections: [{ id: "8A", class_teacher_id: "T" }],
  students: [
    { id: "s1", class_section_id: "8A" },
    { id: "s2", class_section_id: "8A" },
  ],
  dtr_events: [] as Record<string, unknown>[],
  attendance_records: [] as Record<string, unknown>[],
});

function use(tables: ReturnType<typeof base>) {
  createClient.mockResolvedValue(fakeSupabase(tables).client);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(MONDAY));
  createClient.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("shouldRemindAttendance", () => {
  it("reminds a class teacher who has not marked anyone today", async () => {
    use(base());
    expect(await shouldRemindAttendance(teacher)).toBe(true);
  });

  it("only class teachers are reminded", async () => {
    use(base());
    for (const role of ["principal", "front_office", "coordinator", "accounts"]) {
      expect(await shouldRemindAttendance({ id: "T", role } as never)).toBe(false);
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("never on a Sunday (IST)", async () => {
    vi.setSystemTime(new Date(SUNDAY));
    use(base());
    expect(await shouldRemindAttendance(teacher)).toBe(false);
  });

  it("uses the IST weekday: Saturday 19:00 UTC is already Sunday in India", async () => {
    vi.setSystemTime(new Date("2026-10-31T19:00:00Z"));
    use(base());
    expect(await shouldRemindAttendance(teacher)).toBe(false);
  });

  it("not for a teacher with no class, or a class with no students", async () => {
    const noClass = base();
    noClass.class_sections = [];
    use(noClass);
    expect(await shouldRemindAttendance(teacher)).toBe(false);

    const noStudents = base();
    noStudents.students = [];
    use(noStudents);
    expect(await shouldRemindAttendance(teacher)).toBe(false);
  });

  it("stops once every student has a record today, but not while one is missing", async () => {
    const partial = base();
    partial.attendance_records = [{ student_id: "s1", date: TODAY }];
    use(partial);
    expect(await shouldRemindAttendance(teacher)).toBe(true);

    const full = base();
    full.attendance_records = [
      { student_id: "s1", date: TODAY },
      { student_id: "s2", date: TODAY },
    ];
    use(full);
    expect(await shouldRemindAttendance(teacher)).toBe(false);
  });

  it("yesterday's records do not count", async () => {
    const t = base();
    t.attendance_records = [
      { student_id: "s1", date: "2026-11-01" },
      { student_id: "s2", date: "2026-11-01" },
    ];
    use(t);
    expect(await shouldRemindAttendance(teacher)).toBe(true);
  });

  describe("holidays", () => {
    const holiday = (classes: (string | null)[]) => ({
      id: "h",
      event_date: TODAY,
      category: "holiday",
      dtr_event_classes: classes.map((class_section_id) => ({ class_section_id })),
    });

    it("a whole-school holiday (no linked classes) suppresses the reminder", async () => {
      const t = base();
      t.dtr_events = [holiday([])];
      use(t);
      expect(await shouldRemindAttendance(teacher)).toBe(false);
    });

    it("a holiday linked to this teacher's class suppresses it", async () => {
      const t = base();
      t.dtr_events = [holiday(["8A"])];
      use(t);
      expect(await shouldRemindAttendance(teacher)).toBe(false);
    });

    it("a holiday for other classes does not", async () => {
      const t = base();
      t.dtr_events = [holiday(["9B"])];
      use(t);
      expect(await shouldRemindAttendance(teacher)).toBe(true);
    });

    it("non-holiday events and other dates do not", async () => {
      const t = base();
      t.dtr_events = [
        { ...holiday([]), category: "exam" },
        { ...holiday([]), event_date: "2026-11-03" },
      ];
      use(t);
      expect(await shouldRemindAttendance(teacher)).toBe(true);
    });
  });
});
