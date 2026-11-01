import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getViewer } from "./session";

function withUser(tables: Parameters<typeof fakeSupabase>[0], userId: string | null) {
  const { client } = fakeSupabase(tables);
  createClient.mockResolvedValue({
    ...client,
    from: client.from.bind(client),
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}

beforeEach(() => createClient.mockReset());

describe("getViewer", () => {
  it("is null when nobody is signed in", async () => {
    withUser({}, null);
    expect(await getViewer()).toBeNull();
  });

  it("resolves a guardian with their linked students and class sections", async () => {
    withUser(
      {
        guardians: [{ id: "g1", auth_user_id: "u1", name: "Mrs K" }],
        guardian_student: [
          { guardian_id: "g1", student_id: "s1", students: { id: "s1", first_name: "Asha", class_sections: { id: "8A", grade: "8" } } },
          { guardian_id: "g1", student_id: "s2", students: { id: "s2", first_name: "Ravi", class_sections: null } },
          { guardian_id: "other", student_id: "s3", students: { id: "s3", first_name: "Not mine", class_sections: null } },
        ],
      },
      "u1",
    );
    const v = await getViewer();
    expect(v).toMatchObject({ type: "guardian", guardian: { id: "g1" } });
    if (v?.type !== "guardian") throw new Error("expected guardian");
    expect(v.students.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(v.students[0].classSection).toEqual({ id: "8A", grade: "8" });
    expect(v.students[1].classSection).toBeNull();
  });

  it("a guardian with no linked students is still a guardian", async () => {
    withUser({ guardians: [{ id: "g1", auth_user_id: "u1" }] }, "u1");
    expect(await getViewer()).toMatchObject({ type: "guardian", students: [] });
  });

  it("resolves an active staff member", async () => {
    withUser({ staff: [{ id: "st1", auth_user_id: "u2", role: "principal", active: true }] }, "u2");
    expect(await getViewer()).toMatchObject({ type: "staff", staff: { id: "st1", role: "principal" } });
  });

  it("does not resolve a deactivated staff member", async () => {
    withUser({ staff: [{ id: "st1", auth_user_id: "u2", role: "principal", active: false }] }, "u2");
    expect(await getViewer()).toBeNull();
  });

  it("is null for a signed-in user linked to neither table", async () => {
    withUser({ guardians: [{ id: "g1", auth_user_id: "someone-else" }] }, "u3");
    expect(await getViewer()).toBeNull();
  });

  it("a user who is somehow both guardian and staff resolves as guardian", async () => {
    withUser(
      {
        guardians: [{ id: "g1", auth_user_id: "u4" }],
        staff: [{ id: "st1", auth_user_id: "u4", role: "principal", active: true }],
      },
      "u4",
    );
    expect((await getViewer())?.type).toBe("guardian");
  });
});
