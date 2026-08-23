// Pure, framework-free display labels — safe to import from server or client
// components (unlike roles.ts, which pulls in "server-only").
import type { Enums } from "@/lib/supabase/database.types";

/** class_teacher shows as "Teacher" — the role covers both class-owning and
 * specialist teachers, not just staff assigned as a class's class teacher. */
export const ROLE_LABELS: Record<Enums<"role">, string> = {
  parent: "Parent",
  class_teacher: "Teacher",
  front_office: "Front office",
  accounts: "Accounts",
  principal: "Principal",
  super_admin: "Super admin",
  coordinator: "Coordinator",
  admin: "Admin (PTM)",
};

export function roleLabel(role: Enums<"role">): string {
  return ROLE_LABELS[role] ?? role;
}
