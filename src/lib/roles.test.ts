import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ getViewer }));

import {
  PRINCIPAL_ROLES,
  isLeadershipRole,
  isPrincipalRole,
  requireLeadership,
  requirePrincipal,
  requireSuperAdmin,
} from "./roles";

const staff = (role: string) => ({ type: "staff", staff: { role } });

beforeEach(() => getViewer.mockReset());

describe("isPrincipalRole", () => {
  it("covers principal, super_admin and coordinator only", () => {
    expect([...PRINCIPAL_ROLES].sort()).toEqual(["coordinator", "principal", "super_admin"]);
    for (const r of ["parent", "class_teacher", "front_office", "accounts", "admin"] as const) {
      expect(isPrincipalRole(r)).toBe(false);
    }
  });
});

describe("requirePrincipal", () => {
  it.each(["principal", "super_admin", "coordinator"])("allows %s", async (role) => {
    getViewer.mockResolvedValue(staff(role));
    await expect(requirePrincipal()).resolves.toMatchObject({ staff: { role } });
  });

  it.each(["class_teacher", "front_office", "accounts"])("rejects %s", async (role) => {
    getViewer.mockResolvedValue(staff(role));
    await expect(requirePrincipal()).rejects.toThrow("Only the principal");
  });

  it("rejects a signed-out visitor and a parent", async () => {
    getViewer.mockResolvedValue(null);
    await expect(requirePrincipal()).rejects.toThrow("Not signed in as staff");
    getViewer.mockResolvedValue({ type: "parent" });
    await expect(requirePrincipal()).rejects.toThrow("Not signed in as staff");
  });
});

describe("requireLeadership", () => {
  it.each(["principal", "super_admin", "coordinator", "front_office"] as const)("allows %s", async (role) => {
    expect(isLeadershipRole(role)).toBe(true);
    getViewer.mockResolvedValue(staff(role));
    await expect(requireLeadership()).resolves.toMatchObject({ staff: { role } });
  });

  it.each(["class_teacher", "accounts"] as const)("rejects %s", async (role) => {
    expect(isLeadershipRole(role)).toBe(false);
    getViewer.mockResolvedValue(staff(role));
    await expect(requireLeadership()).rejects.toThrow("Only school leadership");
  });

  it("rejects signed-out and parent viewers", async () => {
    getViewer.mockResolvedValue(null);
    await expect(requireLeadership()).rejects.toThrow("Not signed in as staff");
    getViewer.mockResolvedValue({ type: "parent" });
    await expect(requireLeadership()).rejects.toThrow("Not signed in as staff");
  });
});

describe("requireSuperAdmin", () => {
  it("allows only super_admin", async () => {
    getViewer.mockResolvedValue(staff("super_admin"));
    await expect(requireSuperAdmin()).resolves.toBeDefined();
    for (const role of ["principal", "coordinator", "front_office"]) {
      getViewer.mockResolvedValue(staff(role));
      await expect(requireSuperAdmin()).rejects.toThrow("Only a super admin");
    }
  });

  it("rejects signed-out and parent viewers", async () => {
    getViewer.mockResolvedValue(null);
    await expect(requireSuperAdmin()).rejects.toThrow("Not signed in as staff");
    getViewer.mockResolvedValue({ type: "parent" });
    await expect(requireSuperAdmin()).rejects.toThrow("Not signed in as staff");
  });
});
