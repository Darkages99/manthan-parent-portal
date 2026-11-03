import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";

const createAdminClient = vi.hoisted(() => vi.fn());
const sendPush = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/notifications/push", () => ({ sendPush }));

import { notifyCalendarEvent } from "./calendar-notify";

// Tue 3 Nov 2026, 23:00 IST (17:30 UTC): "today" must be the IST date.
const NOW = "2026-11-03T17:30:00Z";

const base = () => ({
  students: [
    { id: "s1", class_section_id: "8A" },
    { id: "s2", class_section_id: "8A" },
    { id: "s3", class_section_id: "9B" },
    { id: "s4", class_section_id: "5A" },
  ],
  custom_group_students: [
    { custom_group_id: "chess", student_id: "s4" },
    { custom_group_id: "chess", student_id: "s1" },
  ],
  guardian_student: [
    { student_id: "s1", guardian_id: "g1" },
    { student_id: "s2", guardian_id: "g2" },
    { student_id: "s2", guardian_id: "g1" }, // g1 has two children in 8A
    { student_id: "s3", guardian_id: "g3" },
    { student_id: "s4", guardian_id: "g4" },
  ],
});

const event = (over: Partial<Parameters<typeof notifyCalendarEvent>[0]> = {}) => ({
  title: "Diwali break",
  eventDate: "2026-11-10",
  category: "holiday" as const,
  classSectionIds: [] as string[],
  groupIds: [] as string[],
  ...over,
});

function use(tables: ReturnType<typeof base>) {
  const fake = fakeSupabase(tables);
  createAdminClient.mockReturnValue(fake.client);
  return fake;
}

const recipients = () =>
  (sendPush.mock.calls[0]?.[0] ?? []).map((r: { userId: string }) => r.userId).sort();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  createAdminClient.mockReset();
  sendPush.mockReset();
  sendPush.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("notifyCalendarEvent", () => {
  it("sends a whole-school event to every guardian, once each", async () => {
    use(base());
    expect(await notifyCalendarEvent(event())).toEqual({ notified: 4 });
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(recipients()).toEqual(["g1", "g2", "g3", "g4"]);
    const [targets, payload, category] = sendPush.mock.calls[0];
    expect(targets.every((t: { role: string }) => t.role === "guardian")).toBe(true);
    expect(payload.title).toBe("Diwali break");
    expect(payload.body).toMatch(/^Holiday on /);
    expect(payload.url).toBe("/dtr");
    expect(category).toBe("calendar");
  });

  it("sends a class event only to that class's guardians", async () => {
    use(base());
    expect(await notifyCalendarEvent(event({ classSectionIds: ["8A"] }))).toEqual({ notified: 2 });
    expect(recipients()).toEqual(["g1", "g2"]);
  });

  it("sends a group event only to the group's guardians", async () => {
    use(base());
    await notifyCalendarEvent(event({ groupIds: ["chess"] }));
    expect(recipients()).toEqual(["g1", "g4"]);
  });

  it("joins class and group audiences without duplicates", async () => {
    use(base());
    expect(await notifyCalendarEvent(event({ classSectionIds: ["9B"], groupIds: ["chess"] }))).toEqual({
      notified: 3,
    });
    expect(recipients()).toEqual(["g1", "g3", "g4"]);
  });

  it("announces an event dated today (IST), but not one dated yesterday", async () => {
    use(base());
    await notifyCalendarEvent(event({ eventDate: "2026-11-03" }));
    expect(sendPush).toHaveBeenCalledTimes(1);

    sendPush.mockClear();
    use(base());
    expect(await notifyCalendarEvent(event({ eventDate: "2026-11-02" }))).toEqual({ notified: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("sends nothing when the targets have no guardians", async () => {
    use(base());
    expect(await notifyCalendarEvent(event({ classSectionIds: ["10C"] }))).toEqual({ notified: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("looks guardians up in chunks so a big audience does not overflow the URL", async () => {
    const t = base();
    t.students = Array.from({ length: 250 }, (_, i) => ({ id: `s${i}`, class_section_id: "8A" }));
    t.guardian_student = t.students.map((s, i) => ({ student_id: s.id, guardian_id: `g${i}` }));
    const fake = use(t);
    expect(await notifyCalendarEvent(event({ classSectionIds: ["8A"] }))).toEqual({ notified: 250 });
    const lookups = fake.queries.filter((q) => q.table === "guardian_student");
    expect(lookups).toHaveLength(3);
    for (const q of lookups) {
      const ids = q.ops.find((op) => op[0] === "in")![2] as unknown[];
      expect(ids.length).toBeLessThanOrEqual(100);
    }
  });
});
