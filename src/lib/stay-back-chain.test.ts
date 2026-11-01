import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildStayBackChainSteps, ensureStayBackChains } from "./stay-back-chain";

const roles = (grade: Parameters<typeof buildStayBackChainSteps>[1]) =>
  buildStayBackChainSteps("t1", grade).map((s) => s.approverRole);

describe("buildStayBackChainSteps", () => {
  it("grades below 8 go teacher → front office → coordinator → principal", () => {
    expect(roles(7)).toEqual(["class_teacher", "front_office", "coordinator", "principal"]);
    expect(roles("1")).toEqual(["class_teacher", "front_office", "coordinator", "principal"]);
  });

  it("grade 8 and above skip the coordinator (the principal acts as coordinator)", () => {
    expect(roles(8)).toEqual(["class_teacher", "front_office", "principal"]);
    expect(roles("12")).toEqual(["class_teacher", "front_office", "principal"]);
  });

  it("accepts zero-padded numeric strings", () => {
    expect(roles("08")).toEqual(["class_teacher", "front_office", "principal"]);
  });

  it("keeps the coordinator when the grade is unknown or not purely numeric", () => {
    for (const g of [null, undefined, "", "8A", "Nursery", " 9"]) {
      expect(roles(g)).toEqual(["class_teacher", "front_office", "coordinator", "principal"]);
    }
  });

  it("pre-assigns only the named class teacher", () => {
    const steps = buildStayBackChainSteps("teacher-42", 5);
    expect(steps[0]).toEqual({ approverRole: "class_teacher", approverStaffId: "teacher-42" });
    expect(steps.slice(1).every((s) => s.approverStaffId === undefined)).toBe(true);
  });
});

describe("ensureStayBackChains", () => {
  function fake(withSteps: string[]) {
    const inserted: Record<string, unknown>[][] = [];
    const client = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            in: async () => ({ data: withSteps.map((subject_id) => ({ subject_id })) }),
          }),
        }),
        insert: async (rows: Record<string, unknown>[]) => {
          expect(table).toBe("approval_steps");
          inserted.push(rows);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient<Database>;
    return { client, inserted };
  }

  const consent = (id: string, status: "pending" | "approved" | "declined" = "pending") => ({
    id,
    teacher_id: `teacher-${id}`,
    student_id: `student-${id}`,
    status,
  });

  it("does nothing when no consent is pending", async () => {
    const { client, inserted } = fake([]);
    expect(await ensureStayBackChains(client, [consent("a", "approved")], {})).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("does nothing when every pending consent already has steps", async () => {
    const { client, inserted } = fake(["a"]);
    expect(await ensureStayBackChains(client, [consent("a")], {})).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("backfills only pending consents with no steps, using each student's grade", async () => {
    const { client, inserted } = fake(["a"]);
    const changed = await ensureStayBackChains(
      client,
      [consent("a"), consent("b"), consent("c"), consent("d", "declined")],
      { "student-b": "9", "student-c": "3" },
    );
    expect(changed).toBe(true);
    expect(inserted).toHaveLength(2);
    const chainRoles = (batch: Record<string, unknown>[]) => batch.map((r) => r.approver_role);
    expect(inserted[0].every((r) => r.subject_id === "b")).toBe(true);
    expect(chainRoles(inserted[0])).toEqual(["class_teacher", "front_office", "principal"]);
    expect(inserted[1].every((r) => r.subject_id === "c")).toBe(true);
    expect(chainRoles(inserted[1])).toEqual(["class_teacher", "front_office", "coordinator", "principal"]);
  });
});
