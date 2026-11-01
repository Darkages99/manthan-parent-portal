import { describe, expect, it } from "vitest";
import { leaveDaySpan, leaveDisplayStatus, leaveNeedsPrincipalApproval } from "./leave-status";

const TODAY = "2026-11-01";

describe("leaveDaySpan", () => {
  it("counts both endpoints", () => {
    expect(leaveDaySpan("2026-11-01", "2026-11-01")).toBe(1);
    expect(leaveDaySpan("2026-11-01", "2026-11-03")).toBe(3);
    expect(leaveDaySpan("2026-11-01", "2026-11-04")).toBe(4);
  });

  it("is unaffected by month, year and DST boundaries", () => {
    expect(leaveDaySpan("2026-01-30", "2026-02-02")).toBe(4);
    expect(leaveDaySpan("2026-12-30", "2027-01-02")).toBe(4);
    expect(leaveDaySpan("2026-03-07", "2026-03-10")).toBe(4);
    expect(leaveDaySpan("2026-10-24", "2026-11-02")).toBe(10);
  });
});

describe("leaveNeedsPrincipalApproval (the 3-day rule)", () => {
  it("a class teacher may approve up to and including 3 days", () => {
    expect(leaveNeedsPrincipalApproval("class_teacher", "2026-11-01", "2026-11-03")).toBe(false);
  });

  it("a class teacher may not approve a 4th day", () => {
    expect(leaveNeedsPrincipalApproval("class_teacher", "2026-11-01", "2026-11-04")).toBe(true);
  });

  it("other staff roles are never blocked by the span", () => {
    for (const role of ["principal", "super_admin", "coordinator", "front_office"] as const) {
      expect(leaveNeedsPrincipalApproval(role, "2026-11-01", "2026-12-31")).toBe(false);
    }
  });
});

describe("leaveDisplayStatus", () => {
  it("a pending request whose last day has passed is expired", () => {
    expect(leaveDisplayStatus({ status: "pending", to_date: "2026-10-31" }, TODAY)).toBe("expired");
  });

  it("a pending request ending today or later is still actionable", () => {
    expect(leaveDisplayStatus({ status: "pending", to_date: TODAY }, TODAY)).toBe("pending");
    expect(leaveDisplayStatus({ status: "pending", to_date: "2026-11-02" }, TODAY)).toBe("pending");
  });

  it("decided requests keep their status even when the window has passed", () => {
    expect(leaveDisplayStatus({ status: "approved", to_date: "2026-01-01" }, TODAY)).toBe("approved");
    expect(leaveDisplayStatus({ status: "declined", to_date: "2026-01-01" }, TODAY)).toBe("declined");
  });
});
