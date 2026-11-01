import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fakes. The sync job reads and writes both sides, so unlike test/fake-supabase.ts
// these keep state: an insert adds a row, an update changes it, and a value
// written to a sheet cell is there on the next read.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type DbHooks = {
  /** Return a message to fail the write; throw to simulate an unexpected error. */
  update?: (table: string, payload: Row, rows: Row[]) => string | undefined;
  insert?: (table: string, rows: Row[]) => string | undefined;
  rpc?: (name: string, args: Row) => string | undefined;
};

function fakeDb(init: Record<string, Row[]>, hooks: DbHooks = {}) {
  const tables: Record<string, Row[]> = structuredClone(init);
  let seq = 0;

  function from(table: string) {
    tables[table] ??= [];
    const filters: ((r: Row) => boolean)[] = [];
    let mode: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; payload: Row } = {
      kind: "select",
    };
    const matching = () => tables[table].filter((r) => filters.every((f) => f(r)));
    const run = () => {
      if (mode.kind === "update") {
        const err = hooks.update?.(table, mode.payload, matching());
        if (err) return { data: null, error: { message: err } };
        for (const r of matching()) Object.assign(r, mode.payload);
        return { data: null, error: null };
      }
      if (mode.kind === "insert") {
        const err = hooks.insert?.(table, mode.rows);
        if (err) return { data: null, error: { message: err } };
        const inserted = mode.rows.map((r) => ({ id: `${table}-new-${++seq}`, ...r }));
        tables[table].push(...inserted);
        return { data: inserted, error: null };
      }
      return { data: matching().map((r) => ({ ...r })), error: null };
    };
    const b = {
      select: () => b,
      order: () => b,
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), b),
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), b),
      is: (col: string, val: unknown) => (filters.push((r) => (r[col] ?? null) === val), b),
      insert: (p: Row | Row[]) => ((mode = { kind: "insert", rows: Array.isArray(p) ? p : [p] }), b),
      update: (p: Row) => ((mode = { kind: "update", payload: p }), b),
      single: async () => {
        const res = run();
        return res.error ? res : { data: (res.data as Row[] | null)?.[0] ?? null, error: null };
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(ok, bad),
    };
    return b;
  }

  // Mirrors migration sync_upsert_guardian: upsert the guardian, replace its links.
  async function rpc(name: string, args: Row) {
    const err = hooks.rpc?.(name, args);
    if (err) return { data: null, error: { message: err } };
    if (name !== "sync_upsert_guardian") return { data: null, error: { message: `no fake rpc ${name}` } };
    const fields = { name: args.p_name, relation: args.p_relation, phone: args.p_phone, email: args.p_email ?? null };
    let id = args.p_id as string | undefined;
    const existing = id && tables.guardians.find((g) => g.id === id);
    if (existing) Object.assign(existing, fields);
    else tables.guardians.push({ id: (id ??= `guardians-new-${++seq}`), ...fields });
    tables.guardian_student = tables.guardian_student.filter((l) => l.guardian_id !== id);
    for (const sid of args.p_student_ids as string[]) tables.guardian_student.push({ guardian_id: id, student_id: sid });
    return { data: id, error: null };
  }

  return { client: { from, rpc }, tables };
}

/** Sheet tabs hold data rows only: index 0 is sheet row 2 (row 1 is the header). */
function fakeSheets(init: Record<string, string[][]>, opts: { hasPendingTab?: boolean; failFormat?: boolean } = {}) {
  const tabs: Record<string, string[][]> = structuredClone(init);
  const titles = [...Object.keys(tabs), ...(opts.hasPendingTab ? ["Pending Deletions"] : [])];
  const pending: { values: string[][] | null } = { values: null };
  const calls = { appends: [] as string[], addSheet: 0, created: [] as unknown[], headerWrites: [] as unknown[] };

  const split = (range: string) => {
    const [tab, a1] = range.split("!");
    return { tab, a1 };
  };
  const setCell = (range: string, value: string) => {
    const { tab, a1 } = split(range);
    const m = /^([A-Z])(\d+)$/.exec(a1)!;
    const col = m[1].charCodeAt(0) - 65;
    const idx = Number(m[2]) - 2;
    const rows = (tabs[tab] ??= []);
    while (rows.length <= idx) rows.push([]);
    while (rows[idx].length <= col) rows[idx].push("");
    rows[idx][col] = value;
  };

  const sheets = {
    spreadsheets: {
      values: {
        get: async ({ range }: { range: string }) => {
          const rows = tabs[split(range).tab] ?? [];
          return { data: { values: rows.length ? rows.map((r) => [...r]) : undefined } };
        },
        append: async ({ range, requestBody }: { range: string; requestBody: { values: string[][] } }) => {
          calls.appends.push(split(range).tab);
          (tabs[split(range).tab] ??= []).push(...requestBody.values.map((r) => r.map(String)));
          return { data: {} };
        },
        batchUpdate: async ({ requestBody }: { requestBody: { data: { range: string; values: string[][] }[] } }) => {
          if (requestBody.data.every((d) => d.range.endsWith("!A1"))) calls.headerWrites.push(requestBody.data);
          else for (const d of requestBody.data) setCell(d.range, d.values[0][0]);
          return { data: {} };
        },
        clear: async () => ((pending.values = []), { data: {} }),
        update: async ({ requestBody }: { requestBody: { values: string[][] } }) => (
          (pending.values = requestBody.values), { data: {} }
        ),
      },
      get: async () => ({
        data: { sheets: titles.map((title, i) => ({ properties: { title, sheetId: i } })) },
      }),
      batchUpdate: async ({ requestBody }: { requestBody: { requests: Row[] } }) => {
        const add = requestBody.requests[0]?.addSheet as { properties: { title: string } } | undefined;
        if (add) {
          calls.addSheet++;
          titles.push(add.properties.title);
          return { data: { replies: [{ addSheet: { properties: { sheetId: titles.length - 1 } } }] } };
        }
        if (opts.failFormat) throw new Error("format failed");
        return { data: {} };
      },
      create: async (req: unknown) => {
        calls.created.push(req);
        return { data: { spreadsheetId: "new-sheet" } };
      },
    },
  };

  /** One column of a tab, by header-relative index; `-1` is the Sync Status column. */
  const column = (tab: string, col: number) =>
    (tabs[tab] ?? []).map((r) => (col < 0 ? (r[r.length - 1] ?? "") : (r[col] ?? "")));

  return { sheets, tabs, pending, calls, column };
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  sheets: null as unknown,
  drive: { permissions: { create: vi.fn() } },
  db: null as unknown,
  logError: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: class {} },
    sheets: () => m.sheets,
    drive: () => m.drive,
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => m.db }));
vi.mock("@/lib/log", () => ({ logError: m.logError }));

import { getSheetsClient, provisionSheet, syncFromSheet } from "./google-sheets";

// ---------------------------------------------------------------------------
// Fixture: a database and a sheet that agree with each other.
// ---------------------------------------------------------------------------

const dbFixture = (): Record<string, Row[]> => ({
  staff: [
    { id: "st1", name: "Anita Rao", role: "class_teacher", phone: "9000000001", email: "anita@school.test" },
    { id: "st2", name: "Priya Nair", role: "principal", phone: "9000000002", email: "priya@school.test" },
  ],
  class_sections: [{ id: "cs1", academic_year: "2026-27", grade: "8", section: "A", class_teacher_id: "st1" }],
  subjects: [{ id: "sub1", name: "Maths" }],
  students: [
    { id: "stu1", first_name: "Asha", last_name: "K", roll_no: "801", class_section_id: "cs1", photo_url: null },
  ],
  guardians: [{ id: "g1", name: "Kiran K", relation: "Mother", phone: "9100000001", email: null }],
  guardian_student: [{ guardian_id: "g1", student_id: "stu1" }],
  timetable_periods: [
    { id: "p1", label: "Period 1", position: 1 },
    { id: "p5", label: "Lunch", position: 5 },
  ],
  timetable_entries: [
    { id: "tt1", class_section_id: "cs1", subject_id: "sub1", day_of_week: 1, period_id: "p1", teacher_id: "st1" },
  ],
  sheet_sync_runs: [],
  sheet_sync_pending_deletions: [],
});

const sheetFixture = (): Record<string, string[][]> => ({
  Teachers: [
    ["st1", "Anita Rao", "class_teacher", "9000000001", ""],
    ["st2", "Priya Nair", "principal", "9000000002", ""],
  ],
  ClassSections: [["cs1", "2026-27", "8", "A", "Anita Rao", ""]],
  Subjects: [["sub1", "Maths", ""]],
  Students: [["stu1", "Asha", "K", "801", "Grade 8 - A", "", ""]],
  Guardians: [["g1", "Kiran K", "Mother", "9100000001", "", "801", ""]],
  Timetable: [["tt1", "Grade 8 - A", "Maths", "1", "1", "Anita Rao", ""]],
});

function setup(
  opts: {
    db?: Record<string, Row[]>;
    sheet?: Record<string, string[][]>;
    hooks?: DbHooks;
    hasPendingTab?: boolean;
    failFormat?: boolean;
  } = {},
) {
  const db = fakeDb(opts.db ?? dbFixture(), opts.hooks);
  const sheet = fakeSheets(opts.sheet ?? sheetFixture(), opts);
  m.db = db.client;
  m.sheets = sheet.sheets;
  return { db, sheet };
}

const lastRun = (db: { tables: Record<string, Row[]> }) => db.tables.sheet_sync_runs.at(-1)!;
const queued = (db: { tables: Record<string, Row[]> }) =>
  db.tables.sheet_sync_pending_deletions.map((p) => `${p.subject_type}:${p.subject_id}`).sort();

beforeEach(() => {
  vi.stubEnv("GOOGLE_SHEETS_CLIENT_EMAIL", "sync@project.iam.test");
  vi.stubEnv("GOOGLE_SHEETS_PRIVATE_KEY", "-----BEGIN KEY-----\\nabc\\n-----END KEY-----");
  vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "sheet-1");
  m.logError.mockReset();
  m.drive.permissions.create.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

// ---------------------------------------------------------------------------

describe("syncFromSheet — run bookkeeping", () => {
  it("a sheet that matches the database: every row OK, nothing queued, run marked success", async () => {
    const { db, sheet } = setup();
    await syncFromSheet();
    for (const tab of Object.keys(sheetFixture())) {
      expect(sheet.column(tab, -1).every((s) => s === "OK"), tab).toBe(true);
    }
    expect(queued(db)).toEqual([]);
    expect(lastRun(db)).toMatchObject({ status: "success" });
    expect(lastRun(db).finished_at).toEqual(expect.any(String));
    expect(m.logError).not.toHaveBeenCalled();
  });

  it("no spreadsheet id: the run is recorded as failed with the reason", async () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "");
    const { db } = setup();
    await syncFromSheet();
    expect(lastRun(db)).toMatchObject({ status: "failed", error_summary: "GOOGLE_SHEETS_SPREADSHEET_ID is not set" });
    expect(m.logError).toHaveBeenCalledWith("[google-sheets] sync failed", expect.any(Error));
  });

  it("missing service-account credentials: run failed, names the env vars", async () => {
    vi.stubEnv("GOOGLE_SHEETS_PRIVATE_KEY", "");
    const { db } = setup();
    await syncFromSheet();
    expect(lastRun(db).status).toBe("failed");
    expect(String(lastRun(db).error_summary)).toContain("GOOGLE_SHEETS_PRIVATE_KEY");
  });

  it("cannot create the run row: still leaves a completed failed record", async () => {
    const { db } = setup({
      hooks: { insert: (t, rows) => (t === "sheet_sync_runs" && !rows[0].status ? "db down" : undefined) },
    });
    await syncFromSheet();
    expect(db.tables.sheet_sync_runs).toEqual([
      expect.objectContaining({ status: "failed", error_summary: "db down", finished_at: expect.any(String) }),
    ]);
  });

  it("never throws, even if recording the failure fails too", async () => {
    setup();
    m.db = {
      from: () => {
        throw new Error("connection reset");
      },
    };
    await expect(syncFromSheet()).resolves.toBeUndefined();
    expect(m.logError).toHaveBeenCalledWith("[google-sheets] failed to record failed sync run", expect.any(Error));
  });
});

describe("syncFromSheet — empty tabs are seeded from the database, not treated as deletions", () => {
  it("exports every tab, reads it back, queues nothing", async () => {
    const { db, sheet } = setup({ sheet: {} });
    await syncFromSheet();
    expect(sheet.calls.appends).toEqual(["Teachers", "ClassSections", "Subjects", "Students", "Guardians", "Timetable"]);
    expect(sheet.tabs.Teachers.map((r) => r.slice(0, 4))).toEqual([
      ["st1", "Anita Rao", "class_teacher", "9000000001"],
      ["st2", "Priya Nair", "principal", "9000000002"],
    ]);
    expect(sheet.tabs.ClassSections[0].slice(0, 5)).toEqual(["cs1", "2026-27", "8", "A", "Anita Rao"]);
    expect(sheet.tabs.Students[0].slice(0, 6)).toEqual(["stu1", "Asha", "K", "801", "Grade 8 - A", ""]);
    expect(sheet.tabs.Guardians[0].slice(0, 6)).toEqual(["g1", "Kiran K", "Mother", "9100000001", "", "801"]);
    expect(sheet.tabs.Timetable[0].slice(0, 6)).toEqual(["tt1", "Grade 8 - A", "Maths", "1", "Period 1", "Anita Rao"]);
    expect(queued(db)).toEqual([]);
    expect(lastRun(db).status).toBe("success");
  });

  it("an empty database leaves empty tabs alone", async () => {
    const empty = Object.fromEntries(Object.keys(dbFixture()).map((k) => [k, []]));
    const { sheet } = setup({ db: empty, sheet: {} });
    await syncFromSheet();
    expect(sheet.calls.appends).toEqual([]);
  });

  it("a tab with any data row is not re-seeded", async () => {
    const { sheet } = setup();
    await syncFromSheet();
    expect(sheet.calls.appends).toEqual([]);
  });
});

describe("syncFromSheet — G-1: a row still in the sheet is never queued for deletion", () => {
  // Each case breaks one existing row (id kept) so it fails validation or the write.
  // The record is still in the sheet, so it must not be queued as "missing".
  const cases: [string, string, (s: Record<string, string[][]>) => void][] = [
    ["Teachers (blank phone)", "staff:st1", (s) => (s.Teachers[0][3] = "")],
    ["Teachers (bad role)", "staff:st1", (s) => (s.Teachers[0][2] = "headmaster")],
    ["ClassSections (unknown teacher)", "class_sections:cs1", (s) => (s.ClassSections[0][4] = "Nobody")],
    ["Subjects (blank name)", "subjects:sub1", (s) => (s.Subjects[0][1] = "")],
    ["Students (unknown class)", "students:stu1", (s) => (s.Students[0][4] = "Grade 9 - Z")],
    ["Guardians (unknown roll no)", "guardians:g1", (s) => (s.Guardians[0][5] = "999")],
    ["Timetable (day 7)", "timetable_entries:tt1", (s) => (s.Timetable[0][3] = "7")],
  ];
  it.each(cases)("%s", async (_name, key, breakRow) => {
    const sheet = sheetFixture();
    breakRow(sheet);
    const { db } = setup({ sheet });
    await syncFromSheet();
    expect(queued(db)).not.toContain(key);
    expect(queued(db)).toEqual([]);
  });

  it("a failed database update on an existing row does not queue it either", async () => {
    const { db, sheet } = setup({
      hooks: { update: (t, _p, rows) => (t === "staff" && rows[0]?.id === "st1" ? "deadlock" : undefined) },
    });
    await syncFromSheet();
    expect(sheet.column("Teachers", -1)[0]).toBe("Error: deadlock");
    expect(queued(db)).toEqual([]);
  });

  it("a failed guardian upsert on an existing row does not queue it", async () => {
    const { db, sheet } = setup({ hooks: { rpc: () => "trigger: guardian needs a child" } });
    await syncFromSheet();
    expect(sheet.column("Guardians", -1)[0]).toBe("Error: trigger: guardian needs a child");
    expect(queued(db)).toEqual([]);
  });
});

describe("syncFromSheet — deletions", () => {
  it("a row removed from the sheet is queued with a snapshot, not deleted", async () => {
    const sheet = sheetFixture();
    sheet.Students = [["", "Ravi", "S", "802", "Grade 8 - A", "", ""]]; // stu1 gone, a new pupil added
    sheet.Guardians = [["g1", "Kiran K", "Mother", "9100000001", "", "", ""]];
    const { db } = setup({ sheet });
    await syncFromSheet();
    expect(queued(db)).toEqual(["students:stu1"]);
    expect(db.tables.sheet_sync_pending_deletions[0].sheet_row_snapshot).toMatchObject({ first_name: "Asha" });
    expect(db.tables.students.map((s) => s.id)).toContain("stu1");
  });

  it("an already-queued deletion is not queued twice", async () => {
    const sheet = sheetFixture();
    sheet.Subjects = [["", "Science", ""]];
    sheet.Timetable = [["tt1", "Grade 8 - A", "", "1", "1", "Anita Rao", ""]];
    const db = dbFixture();
    db.sheet_sync_pending_deletions = [
      { subject_type: "subjects", subject_id: "sub1", resolved_at: null, detected_at: "2026-10-31T00:00:00Z" },
    ];
    const ctx = setup({ db, sheet });
    await syncFromSheet();
    await syncFromSheet();
    expect(queued(ctx.db)).toEqual(["subjects:sub1"]);
  });

  it("a resolved earlier deletion does not stop a new one", async () => {
    const sheet = sheetFixture();
    sheet.Subjects = [["", "Science", ""]];
    sheet.Timetable = [["tt1", "Grade 8 - A", "", "1", "1", "Anita Rao", ""]];
    const db = dbFixture();
    db.sheet_sync_pending_deletions = [
      { subject_type: "subjects", subject_id: "sub1", resolved_at: "2026-10-01T00:00:00Z", detected_at: "x" },
    ];
    const ctx = setup({ db, sheet });
    await syncFromSheet();
    expect(ctx.db.tables.sheet_sync_pending_deletions.filter((p) => !p.resolved_at)).toHaveLength(1);
  });
});

describe("syncFromSheet — Pending Deletions tab", () => {
  const removeStudent = () => {
    const sheet = sheetFixture();
    sheet.Students = [];
    sheet.Students.push(["", "Ravi", "S", "802", "Grade 8 - A", "", ""]);
    sheet.Guardians[0][5] = "";
    return sheet;
  };

  it("creates the tab when missing and lists unresolved deletions with a readable label", async () => {
    const { sheet } = setup({ sheet: removeStudent() });
    await syncFromSheet();
    expect(sheet.calls.addSheet).toBe(1);
    expect(sheet.pending.values![0]).toEqual(["Type", "Name / label", "Record ID", "Missing since", "Last known details"]);
    expect(sheet.pending.values!.slice(1).map((r) => r.slice(0, 3))).toEqual([["Student", "Asha K", "stu1"]]);
  });

  it("reuses an existing tab and writes only the header when nothing is pending", async () => {
    const { sheet } = setup({ hasPendingTab: true });
    await syncFromSheet();
    expect(sheet.calls.addSheet).toBe(0);
    expect(sheet.pending.values).toHaveLength(1);
  });

  it("a formatting failure is logged and does not fail the run", async () => {
    const { db } = setup({ sheet: removeStudent(), failFormat: true });
    await syncFromSheet();
    expect(m.logError).toHaveBeenCalledWith(
      "[google-sheets] failed to refresh the Pending Deletions tab",
      expect.any(Error),
    );
    expect(lastRun(db).status).toBe("success");
  });
});

describe("syncFromSheet — Teachers tab", () => {
  it("adds a new teacher, writes the new id back, derives a username", async () => {
    const sheet = sheetFixture();
    sheet.Teachers.push(["", "  Mohan Das ", "coordinator", "98765 43210", ""]);
    const { db, sheet: s } = setup({ sheet });
    await syncFromSheet();
    const added = db.tables.staff.find((r) => r.name === "Mohan Das")!;
    expect(added).toMatchObject({ role: "coordinator", phone: "98765 43210", username: "mohan_das_3210" });
    expect(s.tabs.Teachers[2][0]).toBe(added.id);
    expect(s.column("Teachers", -1)[2]).toBe("OK");
  });

  it("amends an existing teacher in place", async () => {
    const sheet = sheetFixture();
    sheet.Teachers[0][3] = "9000000099";
    const { db } = setup({ sheet });
    await syncFromSheet();
    expect(db.tables.staff.find((r) => r.id === "st1")!.phone).toBe("9000000099");
  });

  it("validation errors go to the row's Sync Status; other rows still apply", async () => {
    const sheet = sheetFixture();
    sheet.Teachers.push(["", "No Phone", "class_teacher", "", ""]);
    sheet.Teachers.push(["", "Bad Role", "admin", "9000000003", ""]);
    sheet.Teachers.push(["", "Good One", "front_office", "9000000004", ""]);
    const { db, sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(s.column("Teachers", -1).slice(2)).toEqual([
      "Error: name and phone are required",
      'Error: role "admin" is not a valid role',
      "OK",
    ]);
    expect(db.tables.staff.map((r) => r.name)).toContain("Good One");
  });

  it("an insert error is reported on the row", async () => {
    const sheet = sheetFixture();
    sheet.Teachers.push(["", "Dup", "class_teacher", "9000000001", ""]);
    const { sheet: s } = setup({
      sheet,
      hooks: { insert: (t) => (t === "staff" ? "duplicate key value violates unique constraint" : undefined) },
    });
    await syncFromSheet();
    expect(s.column("Teachers", -1)[2]).toBe("Error: duplicate key value violates unique constraint");
  });

  it("an unexpected exception on one row is caught and reported on that row", async () => {
    const { sheet: s, db } = setup({
      hooks: {
        update: (t, _p, rows) => {
          if (t === "staff" && rows[0]?.id === "st2") throw new Error("socket hang up");
          return undefined;
        },
      },
    });
    await syncFromSheet();
    expect(s.column("Teachers", -1)).toEqual(["OK", "Error: socket hang up"]);
    expect(lastRun(db).status).toBe("success");
  });

  it("blank rows are skipped without a status", async () => {
    const sheet = sheetFixture();
    sheet.Teachers.splice(1, 0, ["", " ", ""]);
    const { sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(s.tabs.Teachers[1]).toEqual(["", " ", ""]);
    expect(s.column("Teachers", -1)[2]).toBe("OK");
  });
});

describe("syncFromSheet — ClassSections tab", () => {
  it("adds a section with its class teacher resolved by name (case/space-insensitive)", async () => {
    const sheet = sheetFixture();
    sheet.ClassSections.push(["", "2026-27", "8", "B", "  priya NAIR ", ""]);
    const { db } = setup({ sheet });
    await syncFromSheet();
    expect(db.tables.class_sections.find((c) => c.section === "B")).toMatchObject({ class_teacher_id: "st2" });
  });

  it("a section with no class teacher is allowed", async () => {
    const sheet = sheetFixture();
    sheet.ClassSections[0][4] = "";
    const { db } = setup({ sheet });
    await syncFromSheet();
    expect(db.tables.class_sections[0].class_teacher_id).toBeNull();
  });

  it("missing fields and unknown teacher are row errors", async () => {
    const sheet = sheetFixture();
    sheet.ClassSections.push(["", "2026-27", "", "C", "", ""]);
    sheet.ClassSections.push(["", "2026-27", "8", "D", "Ghost", ""]);
    const { sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(s.column("ClassSections", -1).slice(1)).toEqual([
      "Error: academic_year, grade and section are required",
      'Error: class teacher "Ghost" not found',
    ]);
  });

  it("insert and update errors are row errors", async () => {
    const sheet = sheetFixture();
    sheet.ClassSections.push(["", "2026-27", "8", "B", "", ""]);
    const { sheet: s } = setup({
      sheet,
      hooks: {
        insert: (t) => (t === "class_sections" ? "unique violation" : undefined),
        update: (t) => (t === "class_sections" ? "locked" : undefined),
      },
    });
    await syncFromSheet();
    expect(s.column("ClassSections", -1)).toEqual(["Error: locked", "Error: unique violation"]);
  });
});

describe("syncFromSheet — Subjects tab", () => {
  it("adds and renames subjects", async () => {
    const sheet = sheetFixture();
    sheet.Subjects[0][1] = "Mathematics";
    sheet.Subjects.push(["", "Science", ""]);
    sheet.Timetable[0][2] = "Mathematics";
    const { db, sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(db.tables.subjects.map((r) => r.name).sort()).toEqual(["Mathematics", "Science"]);
    expect(s.column("Subjects", 0)[1]).toMatch(/^subjects-new-/);
    expect(s.column("Timetable", -1)).toEqual(["OK"]);
  });

  it("insert and update errors are row errors", async () => {
    const sheet = sheetFixture();
    sheet.Subjects.push(["", "Science", ""]);
    const { sheet: s } = setup({
      sheet,
      hooks: {
        insert: (t) => (t === "subjects" ? "dup" : undefined),
        update: (t) => (t === "subjects" ? "locked" : undefined),
      },
    });
    await syncFromSheet();
    expect(s.column("Subjects", -1)).toEqual(["Error: locked", "Error: dup"]);
  });
});

describe("syncFromSheet — Students tab", () => {
  it("adds a student into a section resolved by its label; blank photo becomes null", async () => {
    const sheet = sheetFixture();
    sheet.Students.push(["", "Ravi", "S", "802", "grade 8 - a", "", ""]);
    const { db, sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(db.tables.students.find((r) => r.roll_no === "802")).toMatchObject({
      class_section_id: "cs1",
      photo_url: null,
    });
    expect(s.column("Students", -1)).toEqual(["OK", "OK"]);
  });

  it("missing fields and unknown section are row errors", async () => {
    const sheet = sheetFixture();
    sheet.Students.push(["", "Ravi", "", "802", "Grade 8 - A", "", ""]);
    sheet.Students.push(["", "Meera", "P", "803", "Grade 12 - Z", "", ""]);
    const { sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(s.column("Students", -1).slice(1)).toEqual([
      "Error: first_name, last_name, roll_no and class_section are required",
      'Error: class section "Grade 12 - Z" not found',
    ]);
  });

  it("insert and update errors are row errors", async () => {
    const sheet = sheetFixture();
    sheet.Students.push(["", "Ravi", "S", "802", "Grade 8 - A", "", ""]);
    const { sheet: s } = setup({
      sheet,
      hooks: {
        insert: (t) => (t === "students" ? "dup roll" : undefined),
        update: (t) => (t === "students" ? "locked" : undefined),
      },
    });
    await syncFromSheet();
    expect(s.column("Students", -1)).toEqual(["Error: locked", "Error: dup roll"]);
  });
});

describe("syncFromSheet — Guardians tab", () => {
  it("adds a guardian linked to several children by roll number", async () => {
    const db = dbFixture();
    db.students.push({ id: "stu2", first_name: "Ravi", last_name: "K", roll_no: "802", class_section_id: "cs1" });
    const sheet = sheetFixture();
    sheet.Students.push(["stu2", "Ravi", "K", "802", "Grade 8 - A", "", ""]);
    sheet.Guardians.push(["", "Raj K", "Father", "9100000002", "raj@home.test", "801, 802", ""]);
    const ctx = setup({ db, sheet });
    await syncFromSheet();
    const raj = ctx.db.tables.guardians.find((g) => g.name === "Raj K")!;
    expect(raj.email).toBe("raj@home.test");
    expect(ctx.db.tables.guardian_student.filter((l) => l.guardian_id === raj.id).map((l) => l.student_id)).toEqual([
      "stu1",
      "stu2",
    ]);
    expect(ctx.sheet.tabs.Guardians[1][0]).toBe(raj.id);
  });

  it("an existing guardian keeps its id (no id written back)", async () => {
    const { sheet } = setup();
    await syncFromSheet();
    expect(sheet.tabs.Guardians[0][0]).toBe("g1");
  });

  it("missing fields, unknown and ambiguous roll numbers are row errors", async () => {
    const db = dbFixture();
    db.students.push({ id: "stu9", first_name: "Twin", last_name: "X", roll_no: "801", class_section_id: "cs1" });
    const sheet = sheetFixture();
    sheet.Students.push(["stu9", "Twin", "X", "801", "Grade 8 - A", "", ""]);
    sheet.Guardians = [
      ["g1", "Kiran K", "Mother", "", "", "801", ""],
      ["", "A", "Father", "1", "", "404", ""],
      ["", "B", "Father", "2", "", "801", ""],
    ];
    const { sheet: s } = setup({ db, sheet });
    await syncFromSheet();
    expect(s.column("Guardians", -1)).toEqual([
      "Error: name, relation and phone are required",
      'Error: no student with roll_no "404"',
      'Error: roll_no "801" matches more than one student',
    ]);
  });
});

describe("syncFromSheet — Timetable tab", () => {
  it("resolves the period by position or by label, subject and teacher by name", async () => {
    const sheet = sheetFixture();
    sheet.Timetable.push(["", "Grade 8 - A", "", "2", "lunch", "", ""]);
    const { db } = setup({ sheet });
    await syncFromSheet();
    const added = db.tables.timetable_entries.find((e) => e.day_of_week === 2)!;
    expect(added).toMatchObject({ period_id: "p5", subject_id: null, teacher_id: null, class_section_id: "cs1" });
    expect(db.tables.timetable_entries.find((e) => e.id === "tt1")).toMatchObject({
      period_id: "p1",
      subject_id: "sub1",
      teacher_id: "st1",
    });
  });

  it("each kind of bad reference is a row error", async () => {
    const sheet = sheetFixture();
    sheet.Timetable.push(
      ["", "", "Maths", "1", "1", "", ""],
      ["", "Grade 8 - A", "Maths", "0", "1", "", ""],
      ["", "Grade 9 - A", "Maths", "1", "1", "", ""],
      ["", "Grade 8 - A", "Maths", "1", "Period 9", "", ""],
      ["", "Grade 8 - A", "Art", "1", "1", "", ""],
      ["", "Grade 8 - A", "Maths", "1", "1", "Ghost", ""],
    );
    const { sheet: s } = setup({ sheet });
    await syncFromSheet();
    expect(s.column("Timetable", -1).slice(1)).toEqual([
      "Error: class_section, day_of_week and period are required",
      "Error: day_of_week must be between 1 (Mon) and 6 (Sat)",
      'Error: class section "Grade 9 - A" not found',
      'Error: period "Period 9" not found',
      'Error: subject "Art" not found',
      'Error: teacher "Ghost" not found',
    ]);
  });

  it("insert and update errors are row errors", async () => {
    const sheet = sheetFixture();
    sheet.Timetable.push(["", "Grade 8 - A", "Maths", "2", "1", "", ""]);
    const { sheet: s } = setup({
      sheet,
      hooks: {
        insert: (t) => (t === "timetable_entries" ? "clash" : undefined),
        update: (t) => (t === "timetable_entries" ? "locked" : undefined),
      },
    });
    await syncFromSheet();
    expect(s.column("Timetable", -1)).toEqual(["Error: locked", "Error: clash"]);
  });
});

describe("getSheetsClient", () => {
  it("throws a message naming both env vars when credentials are missing", () => {
    vi.stubEnv("GOOGLE_SHEETS_CLIENT_EMAIL", "");
    expect(() => getSheetsClient()).toThrow(/GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY/);
  });
});

describe("provisionSheet", () => {
  it("with an existing spreadsheet: shares it with principals and super admins who have an email", async () => {
    const db = dbFixture();
    db.staff.push({ id: "st3", name: "Sam", role: "super_admin", phone: "1", email: null });
    db.staff.push({ id: "st4", name: "Sara", role: "super_admin", phone: "2", email: "sara@school.test" });
    const { sheet } = setup({ db });
    const res = await provisionSheet();
    expect(res).toEqual({ spreadsheetId: "sheet-1", url: "https://docs.google.com/spreadsheets/d/sheet-1/edit" });
    expect(sheet.calls.created).toEqual([]);
    expect(m.drive.permissions.create.mock.calls.map((c) => c[0].requestBody.emailAddress)).toEqual([
      "priya@school.test",
      "sara@school.test",
    ]);
    expect(m.drive.permissions.create.mock.calls[0][0]).toMatchObject({
      fileId: "sheet-1",
      sendNotificationEmail: false,
      requestBody: { type: "user", role: "writer" },
    });
  });

  it("without one: creates the spreadsheet with all six tabs and their header rows", async () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", undefined);
    const { sheet } = setup();
    const res = await provisionSheet();
    expect(res.spreadsheetId).toBe("new-sheet");
    const titles = (sheet.calls.created[0] as { requestBody: { sheets: { properties: { title: string } }[] } })
      .requestBody.sheets.map((t) => t.properties.title);
    expect(titles).toEqual(["Students", "Guardians", "Teachers", "ClassSections", "Subjects", "Timetable"]);
    const headers = sheet.calls.headerWrites[0] as { range: string; values: string[][] }[];
    expect(headers.find((h) => h.range === "Teachers!A1")!.values[0]).toEqual([
      "id",
      "name",
      "role",
      "phone",
      "Sync Status",
    ]);
  });

  it("a failed share is logged and the others still go out", async () => {
    const db = dbFixture();
    db.staff.push({ id: "st4", name: "Sara", role: "super_admin", phone: "2", email: "sara@school.test" });
    setup({ db });
    m.drive.permissions.create.mockRejectedValueOnce(new Error("quota"));
    await provisionSheet();
    expect(m.drive.permissions.create).toHaveBeenCalledTimes(2);
    expect(m.logError).toHaveBeenCalledWith(
      "[google-sheets] failed to share spreadsheet with a recipient",
      expect.any(Error),
    );
  });

  it("missing credentials: says where it failed", async () => {
    vi.stubEnv("GOOGLE_SHEETS_PRIVATE_KEY", "");
    setup();
    await expect(provisionSheet()).rejects.toThrow(/^Can't provision the sheet — Google Sheets sync needs/);
  });

  it("a Sheets API failure while creating is wrapped with a hint", async () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", undefined);
    const { sheet } = setup();
    sheet.sheets.spreadsheets.create = async () => {
      throw new Error("PERMISSION_DENIED");
    };
    await expect(provisionSheet()).rejects.toThrow(/check the service account has Sheets API access.*PERMISSION_DENIED/);
  });

  it("no spreadsheetId in the create response is an error", async () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", undefined);
    const { sheet } = setup();
    sheet.sheets.spreadsheets.create = async () => ({ data: {} }) as never;
    await expect(provisionSheet()).rejects.toThrow(/did not return a spreadsheetId/);
  });

  it("a database error reading staff is thrown", async () => {
    setup();
    m.db = {
      from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "permission denied" } }) }) }),
    };
    await expect(provisionSheet()).rejects.toThrow("permission denied");
  });
});
