import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../../test/fake-supabase";
import { fetchAttendanceForDate } from "./attendance-today";

type Client = Parameters<typeof fetchAttendanceForDate>[0];
const asServer = (c: unknown) => c as Client;

const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
const records = (n: number, date = "2026-11-02") =>
  ids(n).map((student_id) => ({ student_id, date, status: "present" }));

describe("fetchAttendanceForDate", () => {
  it("returns [] without querying when there are no students", async () => {
    const { client, queries } = fakeSupabase({});
    expect(await fetchAttendanceForDate(asServer(client), "2026-11-02", [])).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it("filters by date and inlines the student list for small scopes", async () => {
    const { client, queries } = fakeSupabase({
      attendance_records: [...records(3), ...records(3, "2026-11-03")],
    });
    const rows = await fetchAttendanceForDate(asServer(client), "2026-11-02", ["s0", "s1"]);
    expect(rows.map((r) => r.student_id)).toEqual(["s0", "s1"]);
    expect(queries[0].ops).toEqual([
      ["eq", "date", "2026-11-02"],
      ["in", "student_id", ["s0", "s1"]],
    ]);
  });

  it("at the 300-student limit it still inlines the list", async () => {
    const { client, queries } = fakeSupabase({ attendance_records: records(300) });
    await fetchAttendanceForDate(asServer(client), "2026-11-02", ids(300));
    expect(queries[0].ops.some((o) => o[0] === "in")).toBe(true);
  });

  it("above the limit it never builds an oversized URL: filters by date, narrows in memory", async () => {
    const wanted = ids(301);
    const { client, queries } = fakeSupabase({
      attendance_records: [...records(301), { student_id: "stranger", date: "2026-11-02", status: "absent" }],
    });
    const rows = await fetchAttendanceForDate(asServer(client), "2026-11-02", wanted);
    expect(queries[0].ops.some((o) => o[0] === "in")).toBe(false);
    expect(rows).toHaveLength(301);
    expect(rows.some((r) => r.student_id === "stranger")).toBe(false);
  });

  it("throws on a query error instead of reading as zero rows", async () => {
    const { client } = fakeSupabase({}, { error: "URI too long" });
    await expect(fetchAttendanceForDate(asServer(client), "2026-11-02", ["s0"])).rejects.toThrow("URI too long");
  });
});
