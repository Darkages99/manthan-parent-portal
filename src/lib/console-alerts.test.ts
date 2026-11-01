import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getConsoleAlerts } from "./console-alerts";

// Mon 2 Nov 2026, 15:30 IST.
const NOW = "2026-11-02T10:00:00Z";
const TODAY = "2026-11-02";

const fixture = () => ({
  class_sections: [
    { id: "8A", grade: "8", section: "A", class_teacher_id: "T" },
    { id: "8B", grade: "8", section: "B", class_teacher_id: "U" },
  ],
  students: [
    { id: "s1", first_name: "Asha", last_name: "K", class_section_id: "8A" },
    { id: "s2", first_name: "Ravi", last_name: "S", class_section_id: "8A" },
    { id: "s3", first_name: "Meera", last_name: "P", class_section_id: "8B" },
  ],
  attendance_records: [
    { student_id: "s1", date: TODAY, status: "absent" },
    { student_id: "s2", date: TODAY, status: "absent" },
    { student_id: "s3", date: TODAY, status: "absent" },
    { student_id: "s1", date: "2026-11-01", status: "absent" }, // yesterday: ignored
  ],
  leave_requests: [
    { id: "ok", student_id: "s2", status: "approved", from_date: "2026-11-01", to_date: "2026-11-03", reason: "Fever" },
    { id: "past", student_id: "s1", status: "approved", from_date: "2026-10-20", to_date: "2026-10-31", reason: "Trip" },
    { id: "l1", student_id: "s1", status: "pending", from_date: "2026-11-04", to_date: "2026-11-05", reason: "x" },
    { id: "l2", student_id: "s1", status: "pending", from_date: "2026-10-28", to_date: "2026-10-30", reason: "x" }, // expired
    { id: "l3", student_id: "s3", status: "pending", from_date: "2026-11-04", to_date: "2026-11-05", reason: "x" },
  ],
  stay_back_consents: [
    { id: "sb1", student_id: "s2", status: "pending", stay_date: "2026-11-09", from_time: "15:00", to_time: "17:00" },
    { id: "sb2", student_id: "s3", status: "pending", stay_date: "2026-11-09", from_time: "15:00", to_time: "17:00" },
    { id: "sb3", student_id: "s1", status: "approved", stay_date: TODAY, from_time: "15:00", to_time: "17:00" },
    { id: "sb4", student_id: "s1", status: "approved", stay_date: "2026-11-03", from_time: "15:00", to_time: "17:00" },
  ],
  exam_results: [
    { student_id: "s1", subject: "Maths", marks: 39, max_marks: 100 },
    { student_id: "s1", subject: "Science", marks: 40, max_marks: 100 }, // exactly 40% → a pass
    { student_id: "s1", subject: "Art", marks: 20, max_marks: 50 }, // 40% of a 50-mark paper → a pass
    { student_id: "s2", subject: "Hindi", marks: 30, max_marks: 100 },
    { student_id: "s2", subject: "English", marks: 10, max_marks: 100 },
    { student_id: "s2", subject: "Art", marks: 0, max_marks: 0 }, // zero max: ignored
    { student_id: "s3", subject: "Maths", marks: 5, max_marks: 100 },
  ],
  homework_assignments: [
    { id: "h1", class_section_id: "8A", due_date: TODAY, checked: false },
    { id: "h2", class_section_id: "8A", due_date: TODAY, checked: true },
    { id: "h3", class_section_id: "8A", due_date: "2026-11-09", checked: false }, // not due today
  ],
  homework_submissions: [
    { homework_id: "h1", student_id: "s1" }, // unchecked default (nobody done): row = DONE
    { homework_id: "h2", student_id: "s2" }, // checked default (everyone done): row = NOT done
  ],
});

const rpc = {
  attendance_summary: () => [
    { student_id: "s1", total: 20, present_pct: 70 },
    { student_id: "s2", total: 20, present_pct: 90 },
    { student_id: "s3", total: 0, present_pct: 0 },
  ],
};

const staff = (role: string, id: string) => ({ role, id }) as never;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  createClient.mockResolvedValue(fakeSupabase(fixture(), { rpc }).client);
});
afterEach(() => vi.useRealTimers());

describe("getConsoleAlerts — class teacher (own class only)", () => {
  it("returns nothing for a teacher with no class", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "nobody"));
    expect(Object.values(a).every((v) => v.length === 0)).toBe(true);
  });

  it("flags students below the 85% attendance minimum, skipping those with no records", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.lowAttendance).toEqual([{ id: "s1", name: "Asha K", className: "Grade 8-A", pct: 70 }]);
  });

  it("lists pending leave that has not expired, only for own students", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.pendingLeave).toEqual([{ id: "l1", name: "Asha K", className: "Grade 8-A" }]);
  });

  it("lists pending stay-back requests for own students only", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.pendingStayBack).toEqual([{ id: "sb1", name: "Ravi S", className: "Grade 8-A" }]);
  });

  it("lists everyone absent today, with the approved-leave reason or a no-leave note", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.absentToday).toEqual([
      { id: "s1", name: "Asha K", className: "Grade 8-A", reason: "No approved leave on record" },
      { id: "s2", name: "Ravi S", className: "Grade 8-A", reason: "Fever" },
    ]);
  });

  it("lists approved leave that covers today, not leave that ended", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.onLeaveToday).toEqual([{ id: "s2", name: "Ravi S", className: "Grade 8-A", reason: "Fever" }]);
  });

  it("lists approved stay-backs for today only", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.stayingBackToday).toEqual([
      { id: "s1", name: "Asha K", className: "Grade 8-A", fromTime: "15:00", toTime: "17:00" },
    ]);
  });

  it("low scores: failing subjects per student, most failing subjects first; zero-max rows ignored", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    expect(a.lowScores).toEqual([
      { id: "s2", name: "Ravi S", className: "Grade 8-A", subjects: ["English", "Hindi"] },
      { id: "s1", name: "Asha K", className: "Grade 8-A", subjects: ["Maths"] },
    ]);
  });

  // School decision (2026-11-01): 40% is a pass, same rule as results-analytics.
  it("pass mark: exactly 40% is a pass, just below is a fail", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    const asha = a.lowScores.find((s) => s.id === "s1");
    expect(asha?.subjects).toEqual(["Maths"]);
  });

  // homework_submissions rows are overrides of the assignment's `checked` default
  // (migration 0036): unchecked ⇒ nobody done, a row means DONE; checked ⇒ everyone
  // done, a row means NOT done. Same rule as homework/page.tsx and homework-notify.ts.
  it("homework due today: respects the checked default and treats a row as an override", async () => {
    const a = await getConsoleAlerts(staff("class_teacher", "T"));
    // h1 (unchecked): s1 has a row → done; s2 has none → not done.
    // h2 (checked):   s2 has a row → not done; s1 has none → done.
    // h3 is not due today. So only s2 is behind, on both assignments.
    expect(a.dueHomeworkToday).toEqual([{ id: "s2", name: "Ravi S", className: "Grade 8-A", count: 2 }]);
  });
});

describe("getConsoleAlerts — principal (whole school)", () => {
  it("sees every class", async () => {
    const a = await getConsoleAlerts(staff("principal", "P"));
    expect(a.pendingLeave.map((l) => l.id).sort()).toEqual(["l1", "l3"]);
    expect(a.pendingStayBack.map((l) => l.id).sort()).toEqual(["sb1", "sb2"]);
    expect(a.absentToday.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    expect(a.absentToday[2].className).toBe("Grade 8-B");
  });

  it("still skips students with no attendance records in the low-attendance list", async () => {
    const a = await getConsoleAlerts(staff("principal", "P"));
    expect(a.lowAttendance.map((s) => s.id)).toEqual(["s1"]);
  });
});
