import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getTaughtClassIds } from "./teacher-scope";

function fake(rows: { class_sections?: unknown[]; timetable_entries?: unknown[]; class_subject_teachers?: unknown[] }) {
  const seen: Record<string, [string, string]> = {};
  const client = {
    from: (table: keyof typeof rows) => ({
      select: () => ({
        eq: async (col: string, val: string) => {
          seen[table] = [col, val];
          return { data: rows[table] ?? null };
        },
      }),
    }),
  } as unknown as SupabaseClient<Database>;
  return { client, seen };
}

describe("getTaughtClassIds", () => {
  it("unions owned, timetabled and directly assigned classes, de-duplicated", async () => {
    const { client } = fake({
      class_sections: [{ id: "c1" }],
      timetable_entries: [{ class_section_id: "c1" }, { class_section_id: "c2" }],
      class_subject_teachers: [{ class_section_id: "c3" }, { class_section_id: "c2" }],
    });
    expect((await getTaughtClassIds(client, "t1")).sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("queries each source by the right teacher column for the given staff id", async () => {
    const { client, seen } = fake({});
    await getTaughtClassIds(client, "staff-9");
    expect(seen).toEqual({
      class_sections: ["class_teacher_id", "staff-9"],
      timetable_entries: ["teacher_id", "staff-9"],
      class_subject_teachers: ["teacher_id", "staff-9"],
    });
  });

  it("returns an empty list for a teacher with no classes (null results)", async () => {
    const { client } = fake({});
    expect(await getTaughtClassIds(client, "t1")).toEqual([]);
  });
});
