import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  computeSubjectStatus,
  createApprovalChain,
  decideApprovalStep,
  type ApprovalStep,
} from "./approvals";

type Decision = ApprovalStep["decision"];
const steps = (...decisions: Decision[]) => decisions.map((decision) => ({ decision }));

describe("computeSubjectStatus", () => {
  it("is pending with no steps", () => {
    expect(computeSubjectStatus([])).toBe("pending");
  });

  it("is pending while any step is undecided", () => {
    expect(computeSubjectStatus(steps("approved", null))).toBe("pending");
    expect(computeSubjectStatus(steps(null, null))).toBe("pending");
  });

  it("is approved only when every step is approved", () => {
    expect(computeSubjectStatus(steps("approved"))).toBe("approved");
    expect(computeSubjectStatus(steps("approved", "approved", "approved"))).toBe("approved");
  });

  it("is declined as soon as any step declines, even with steps still open", () => {
    expect(computeSubjectStatus(steps("declined", null))).toBe("declined");
    expect(computeSubjectStatus(steps("approved", "declined", null))).toBe("declined");
  });

  it("decline beats approvals regardless of order", () => {
    expect(computeSubjectStatus(steps("approved", "approved", "declined"))).toBe("declined");
  });
});

/**
 * Minimal in-memory stand-in for the two query shapes approvals.ts uses:
 *   from().select().eq().eq().order()   (read chain)
 *   from().update().eq()                (decide) / from().insert()
 */
function fakeSupabase(initial: Partial<ApprovalStep>[]) {
  const rows = initial.map((r, i) => ({
    id: `s${i + 1}`,
    subject_type: "stay_back_consent",
    subject_id: "subj",
    step_order: i + 1,
    approver_role: "class_teacher",
    approver_staff_id: null,
    decision: null,
    decided_at: null,
    ...r,
  })) as ApprovalStep[];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const inserted: Record<string, unknown>[][] = [];

  const client = {
    from: () => ({
      select: () => {
        const q = { eq: () => q, order: async () => ({ data: rows, error: null }) };
        return q;
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, patch });
          return { error: null };
        },
      }),
      insert: async (batch: Record<string, unknown>[]) => {
        inserted.push(batch);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient<Database>;

  return { client, updates, inserted };
}

describe("createApprovalChain", () => {
  it("numbers steps from 1 in the given order and defaults the staff id to null", async () => {
    const { client, inserted } = fakeSupabase([]);
    await createApprovalChain(client, "stay_back_consent", "subj", [
      { approverRole: "class_teacher", approverStaffId: "t1" },
      { approverRole: "coordinator" },
      { approverRole: "principal" },
    ]);
    expect(inserted[0]).toEqual([
      { subject_type: "stay_back_consent", subject_id: "subj", step_order: 1, approver_role: "class_teacher", approver_staff_id: "t1" },
      { subject_type: "stay_back_consent", subject_id: "subj", step_order: 2, approver_role: "coordinator", approver_staff_id: null },
      { subject_type: "stay_back_consent", subject_id: "subj", step_order: 3, approver_role: "principal", approver_staff_id: null },
    ]);
  });
});

describe("decideApprovalStep", () => {
  const base = { subjectType: "stay_back_consent", subjectId: "subj" } as const;

  it("decides the caller's step and reports the chain as still pending", async () => {
    const { client, updates } = fakeSupabase([
      { approver_role: "class_teacher", approver_staff_id: "t1" },
      { approver_role: "principal" },
    ]);
    const status = await decideApprovalStep(client, {
      ...base,
      approverRole: "class_teacher",
      staffId: "t1",
      decision: "approved",
      matchByStaffId: true,
    });
    expect(status).toBe("pending");
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("s1");
    expect(updates[0].patch).toMatchObject({ decision: "approved", approver_staff_id: "t1" });
  });

  it("reports approved once the last open step is approved", async () => {
    const { client } = fakeSupabase([
      { approver_role: "class_teacher", decision: "approved" },
      { approver_role: "principal" },
    ]);
    const status = await decideApprovalStep(client, {
      ...base,
      approverRole: "principal",
      staffId: "p1",
      decision: "approved",
    });
    expect(status).toBe("approved");
  });

  it("a decline closes the subject immediately", async () => {
    const { client } = fakeSupabase([{ approver_role: "front_office" }, { approver_role: "principal" }]);
    const status = await decideApprovalStep(client, {
      ...base,
      approverRole: "front_office",
      staffId: "f1",
      decision: "declined",
    });
    expect(status).toBe("declined");
  });

  it("keeps a pre-assigned approver rather than overwriting with the caller", async () => {
    const { client, updates } = fakeSupabase([{ approver_role: "principal", approver_staff_id: "assigned" }]);
    await decideApprovalStep(client, { ...base, approverRole: "principal", staffId: "other", decision: "approved" });
    expect(updates[0].patch).toMatchObject({ approver_staff_id: "assigned" });
  });

  it("with matchByStaffId, refuses a step pre-assigned to a different teacher", async () => {
    const { client, updates } = fakeSupabase([{ approver_role: "class_teacher", approver_staff_id: "t1" }]);
    await expect(
      decideApprovalStep(client, {
        ...base,
        approverRole: "class_teacher",
        staffId: "t2",
        decision: "approved",
        matchByStaffId: true,
      }),
    ).rejects.toThrow(/No open approval step/);
    expect(updates).toHaveLength(0);
  });

  it("refuses to re-decide an already decided step", async () => {
    const { client, updates } = fakeSupabase([{ approver_role: "principal", decision: "approved" }]);
    await expect(
      decideApprovalStep(client, { ...base, approverRole: "principal", staffId: "p1", decision: "declined" }),
    ).rejects.toThrow(/already decided/);
    expect(updates).toHaveLength(0);
  });

  it("with anyOpenStep, decides the first open step whatever its role", async () => {
    const { client, updates } = fakeSupabase([
      { approver_role: "class_teacher", approver_staff_id: "t1", decision: "approved" },
      { approver_role: "front_office" },
      { approver_role: "coordinator" },
    ]);
    const status = await decideApprovalStep(client, {
      ...base,
      approverRole: "principal",
      staffId: "sa1",
      decision: "approved",
      anyOpenStep: true,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toMatchObject({ approver_staff_id: "sa1" });
    expect(status).toBe("pending");
  });

  it("refuses a role that has no step in the chain", async () => {
    const { client } = fakeSupabase([{ approver_role: "coordinator" }]);
    await expect(
      decideApprovalStep(client, { ...base, approverRole: "principal", staffId: "p1", decision: "approved" }),
    ).rejects.toThrow(/No open approval step/);
  });
});
