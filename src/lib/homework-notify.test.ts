import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";

const createAdminClient = vi.hoisted(() => vi.fn());
const sendPush = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/notifications/push", () => ({ sendPush }));

import { notifyUnsubmittedHomework } from "./homework-notify";

// Tue 3 Nov 2026 15:30 IST → "yesterday" is Mon 2 Nov.
const NOW = "2026-11-03T10:00:00Z";
const YESTERDAY = "2026-11-02";

const base = () => ({
  homework_assignments: [
    { id: "h1", title: "Fractions", class_section_id: "8A", checked: false, due_date: YESTERDAY },
    { id: "h2", title: "Poem", class_section_id: "8A", checked: true, due_date: YESTERDAY },
    { id: "h3", title: "Not yet due", class_section_id: "8A", checked: false, due_date: "2026-11-05" },
  ],
  students: [
    { id: "s1", class_section_id: "8A" },
    { id: "s2", class_section_id: "8A" },
    { id: "s3", class_section_id: "9B" },
  ],
  // unchecked h1: a row = DONE (s1 did it). checked h2: a row = NOT done (s2 didn't).
  homework_submissions: [
    { homework_id: "h1", student_id: "s1" },
    { homework_id: "h2", student_id: "s2" },
  ],
  homework_notifications: [] as Record<string, unknown>[],
  guardian_student: [
    { student_id: "s1", guardian_id: "g1" },
    { student_id: "s2", guardian_id: "g2" },
    { student_id: "s2", guardian_id: "g3" },
    { student_id: "s3", guardian_id: "g4" }, // s3 is in 9B, which has no homework
  ],
});

function use(tables: ReturnType<typeof base>) {
  const fake = fakeSupabase(tables);
  createAdminClient.mockReturnValue(fake.client);
  return fake;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  createAdminClient.mockReset();
  sendPush.mockReset();
  sendPush.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("notifyUnsubmittedHomework", () => {
  it("notifies the guardians of students who haven't done yesterday's homework, honouring the checked default", async () => {
    use(base());
    const res = await notifyUnsubmittedHomework();

    // h1 (unchecked): s1 done via row; s2 has no row → not done.
    // h2 (checked):   s1 no row → done; s2 has a row → not done.
    expect(res).toEqual({ notified: 2 });
    expect(sendPush).toHaveBeenCalledTimes(2);
    const bodies = sendPush.mock.calls.map(([, payload]) => payload.body).sort();
    expect(bodies[0]).toContain("Fractions");
    expect(bodies[1]).toContain("Poem");
    for (const [recipients, payload, category] of sendPush.mock.calls) {
      expect(recipients).toEqual([
        { userId: "g2", role: "guardian" },
        { userId: "g3", role: "guardian" },
      ]);
      expect(payload.url).toBe("/homework");
      expect(category).toBe("defaulters");
    }
  });

  it("is idempotent: records what it sent and does not repeat it", async () => {
    const t = base();
    const first = use(t);
    await notifyUnsubmittedHomework();
    const upsert = first.writes.find((w) => w.table === "homework_notifications");
    expect(upsert?.kind).toBe("upsert");
    expect(upsert?.options).toEqual({ onConflict: "homework_id,student_id" });
    expect(upsert?.payload).toEqual([
      { homework_id: "h1", student_id: "s2" },
      { homework_id: "h2", student_id: "s2" },
    ]);

    // Next cron run: those pairs are already recorded.
    sendPush.mockClear();
    t.homework_notifications = upsert!.payload as Record<string, unknown>[];
    use(t);
    expect(await notifyUnsubmittedHomework()).toEqual({ notified: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("does nothing when no homework was due yesterday", async () => {
    const t = base();
    t.homework_assignments = t.homework_assignments.filter((a) => a.due_date !== YESTERDAY);
    use(t);
    expect(await notifyUnsubmittedHomework()).toEqual({ notified: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("does nothing when everyone is done", async () => {
    const t = base();
    t.homework_assignments = [t.homework_assignments[0]];
    t.homework_submissions = [
      { homework_id: "h1", student_id: "s1" },
      { homework_id: "h1", student_id: "s2" },
    ];
    use(t);
    expect(await notifyUnsubmittedHomework()).toEqual({ notified: 0 });
  });

  it("does not notify students from other classes", async () => {
    use(base());
    await notifyUnsubmittedHomework();
    const recipients = sendPush.mock.calls.flatMap(([r]) => r.map((x: { userId: string }) => x.userId));
    expect(recipients.length).toBeGreaterThan(0);
    expect(recipients).not.toContain("g4");
  });

  it("logs, but does not fail, if recording the notifications errors", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    // Fail only the notification-recording table; everything else behaves normally.
    const real = fakeSupabase(base());
    createAdminClient.mockReturnValue({
      from: (table: string) =>
        table === "homework_notifications"
          ? {
              select: () => ({ in: async () => ({ data: [] }) }),
              upsert: async () => ({ error: { code: "42501", message: "secret row text" } }),
            }
          : real.from(table),
    });
    await expect(notifyUnsubmittedHomework()).resolves.toEqual({ notified: 2 });
    expect(err).toHaveBeenCalledWith("[homework-notify] couldn't record notifications [42501]");
  });
});
