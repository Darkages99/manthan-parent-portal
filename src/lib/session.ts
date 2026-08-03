import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type GuardianViewer = {
  type: "guardian";
  guardian: Tables<"guardians">;
  students: (Tables<"students"> & { classSection: Tables<"class_sections"> | null })[];
};

export type StaffViewer = {
  type: "staff";
  staff: Tables<"staff">;
};

export type Viewer = GuardianViewer | StaffViewer | null;

/**
 * Resolves the signed-in Supabase user to their guardian or staff row. Null if unauthenticated or unlinked.
 * Wrapped in React `cache()` so the layout, page, and any server actions invoked during the same
 * request share one lookup instead of each re-running the auth + DB round trips from scratch.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: guardian } = await supabase
    .from("guardians")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (guardian) {
    const { data: links } = await supabase
      .from("guardian_student")
      .select("student_id, students(*, class_sections(*))")
      .eq("guardian_id", guardian.id);

    const students = (links ?? []).map((link) => {
      const student = link.students as unknown as Tables<"students"> & {
        class_sections: Tables<"class_sections"> | null;
      };
      return { ...student, classSection: student.class_sections };
    });

    return { type: "guardian", guardian, students };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staff) return { type: "staff", staff };

  return null;
});
