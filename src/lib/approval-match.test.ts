import { describe, expect, it } from "vitest";
import { resolveApproverMatch } from "./approval-match";

const NAMED = "teacher-1";

describe("resolveApproverMatch", () => {
  it("lets only the named class teacher decide, matching by staff id", () => {
    expect(resolveApproverMatch("class_teacher", NAMED, NAMED)).toEqual({
      approverRole: "class_teacher",
      matchByStaffId: true,
    });
  });

  it("rejects a class teacher who is not the named one", () => {
    expect(resolveApproverMatch("class_teacher", "teacher-2", NAMED)).toBeNull();
  });

  it.each(["front_office", "coordinator"] as const)("%s decides their own step by role", (role) => {
    expect(resolveApproverMatch(role, "anyone", NAMED)).toEqual({
      approverRole: role,
      matchByStaffId: false,
    });
  });

  it.each(["principal", "super_admin"] as const)("%s satisfies the principal step", (role) => {
    expect(resolveApproverMatch(role, "anyone", NAMED)).toEqual({
      approverRole: "principal",
      matchByStaffId: false,
    });
  });

  it.each(["parent", "accounts", "admin"] as const)("%s is not a party to the chain", (role) => {
    expect(resolveApproverMatch(role, NAMED, NAMED)).toBeNull();
  });
});
