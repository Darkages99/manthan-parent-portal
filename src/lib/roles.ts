import "server-only";
import { getViewer, type StaffViewer } from "@/lib/session";
import type { Enums } from "@/lib/supabase/database.types";

/**
 * Roles that run the school: full access to classes, timetable and results.
 * Coordinator is treated as fully admin-equivalent — same standing as
 * principal/super_admin everywhere this list gates an action.
 */
export const PRINCIPAL_ROLES: Enums<"role">[] = ["principal", "super_admin", "coordinator"];

export function isPrincipalRole(role: Enums<"role">): boolean {
  return PRINCIPAL_ROLES.includes(role);
}

/**
 * Principal-tier plus front office: may add, edit and delete classes and their
 * subject teachers (is_leadership() in migration 0054), and add and edit
 * students and parents (admissions, migration 0057).
 */
const LEADERSHIP_ROLES: Enums<"role">[] = [...PRINCIPAL_ROLES, "front_office"];

export function isLeadershipRole(role: Enums<"role">): boolean {
  return LEADERSHIP_ROLES.includes(role);
}

/** Guards a server action to LEADERSHIP_ROLES. Throws otherwise. */
export async function requireLeadership(): Promise<StaffViewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  if (!isLeadershipRole(viewer.staff.role)) {
    throw new Error("Only school leadership or the front office can perform this action");
  }
  return viewer;
}

/**
 * Guards a server action to the principal / super_admin / coordinator. Throws
 * otherwise. (Reads are additionally enforced by RLS via current_staff_role().)
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
