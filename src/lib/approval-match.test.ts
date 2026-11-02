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

  it.each(["front_office", "coordinator", "principal"] as const)("%s decides their own step by role", (role) => {
    expect(resolveApproverMatch(role, "anyone", NAMED)).toEqual({
      approverRole: role,
      matchByStaffId: false,
    });
  });

  it("lets super_admin decide any open step", () => {
    expect(resolveApproverMatch("super_admin", "anyone", NAMED)).toMatchObject({ anyOpenStep: true });
  });

  it("an unknown role is not a party to the chain", () => {
    expect(resolveApproverMatch("janitor" as never, NAMED, NAMED)).toBeNull();
  });
});
