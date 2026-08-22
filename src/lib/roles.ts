import "server-only";
import { getViewer, type StaffViewer } from "@/lib/session";
import type { Enums } from "@/lib/supabase/database.types";

/** Roles that run the school: full access to classes, timetable and results. */
export const PRINCIPAL_ROLES: Enums<"role">[] = ["principal", "super_admin"];

export function isPrincipalRole(role: Enums<"role">): boolean {
  return PRINCIPAL_ROLES.includes(role);
}

/**
 * Guards a server action to the principal / super_admin. Throws otherwise.
 * (Reads are additionally enforced by RLS via current_staff_role().)
 */
export async function requirePrincipal(): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!isPrincipalRole(viewer.staff.role)) {
    throw new Error("Only the principal can perform this action");
  }
  return viewer;
}

/**
 * Guards a server action to super_admin only — stricter than requirePrincipal().
 * Used for the sheet-sync pending-deletion confirm action, since that's the one
 * place a row queued for deletion actually gets removed from Postgres.
 */
export async function requireSuperAdmin(): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (viewer.staff.role !== "super_admin") {
    throw new Error("Only a super admin can perform this action");
  }
  return viewer;
}
