import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Google Sheets roster/academic-config sync.
//
// The Sheet is the SINGLE write path for students, guardians, staff ("Teachers"),
// class sections, subjects and the timetable. The app displays this data
// read-only (which also matches current RLS: none of those tables carry a
// staff write policy — see supabase/migrations/0001_init.sql — so only this
// service-role job, or a super_admin resolving a pending deletion, can
// mutate them). Additions/amendments apply automatically; a row that
// disappears from the sheet is queued in `sheet_sync_pending_deletions`
// rather than deleted, so a super_admin has to confirm data loss explicitly.
// ---------------------------------------------------------------------------

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const ROLE_VALUES: Enums<"role">[] = [
  "parent",
  "class_teacher",
  "front_office",
  "accounts",
  "principal",
  "super_admin",
  "coordinator",
];

function getServiceAccountAuth() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Sheets sync needs GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY."
    );
  }
  return new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: SCOPES });
}

/** Authenticated Sheets API client, built from the service-account env vars. */
export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getServiceAccountAuth() });
}

function getDriveClient() {
  return google.drive({ version: "v3", auth: getServiceAccountAuth() });
}

// ---------------------------------------------------------------------------
// Tab layout — column order is fixed and matches the header row written by
// provisionSheet(). The last column of every tab is "Sync Status", which the
// sync job writes back to after processing each row.
// ---------------------------------------------------------------------------

const TAB_HEADERS = {
  Students: ["id", "first_name", "last_name", "roll_no", "class_section", "photo_url", "Sync Status"],
  Guardians: ["id", "name", "relation", "phone", "email", "linked_roll_nos", "Sync Status"],
  Teachers: ["id", "name", "role", "phone", "Sync Status"],
  ClassSections: ["id", "academic_year", "grade", "section", "class_teacher_name", "Sync Status"],
  Subjects: ["id", "name", "Sync Status"],
  Timetable: ["id", "class_section", "subject", "day_of_week", "period", "teacher_name", "Sync Status"],
} as const;

type TabName = keyof typeof TAB_HEADERS;
const TAB_NAMES = Object.keys(TAB_HEADERS) as TabName[];

function colLetter(index: number): string {
  return String.fromCharCode(65 + index); // fine for our tabs — all are <= 7 columns (A-G)
}

function statusColLetter(tab: TabName): string {
  return colLetter(TAB_HEADERS[tab].length - 1);
}

function statusCell(tab: TabName, sheetRow: number, message: string): sheets_v4.Schema$ValueRange {
  return { range: `${tab}!${statusColLetter(tab)}${sheetRow}`, values: [[message]] };
}

function idCell(tab: TabName, sheetRow: number, id: string): sheets_v4.Schema$ValueRange {
  return { range: `${tab}!A${sheetRow}`, values: [[id]] };
}

function cell(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return cell(value).toLowerCase();
}

async function readTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: TabName
): Promise<string[][]> {
  const lastCol = colLetter(TAB_HEADERS[tab].length - 1);
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A2:${lastCol}5000`,
  });
  return (data.values ?? []) as string[][];
}

function classSectionLabel(row: { grade: string; section: string }): string {
  return `Grade ${row.grade} - ${row.section}`;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * The core sync job. Reads all six tabs, applies additions (blank id) and
 * amendments (id present) to Postgres, writes generated ids + a per-row
 * status back to the sheet, then queues any Postgres row that's no longer
 * present in the sheet for manual deletion review. Never throws — always
 * leaves a completed `sheet_sync_runs` row, success or failed.
 */
export async function syncFromSheet(): Promise<void> {
  const supabase = createAdminClient();
  let runId: string | null = null;

  try {
    const { data: run, error: runError } = await supabase
      .from("sheet_sync_runs")
      .insert({})
      .select("id")
      .single();
    if (runError || !run) {
      throw new Error(runError?.message ?? "Could not create sheet_sync_runs row");
    }
    runId = run.id;

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set");

    const sheets = getSheetsClient();
    const seenIds: Record<string, Set<string>> = {
      staff: new Set(),
      class_sections: new Set(),
      subjects: new Set(),
      students: new Set(),
      guardians: new Set(),
      timetable_entries: new Set(),
    };

    // Order matters: later tabs resolve human-readable cross-refs against
    // rows written by earlier ones (Students needs ClassSections, Guardians
    // needs Students, Timetable needs ClassSections/Subjects/Teachers).
    await syncTeachers(sheets, spreadsheetId, supabase, seenIds.staff);
    const { data: staffRows } = await supabase.from("staff").select("id, name, role");
    const staffByName = new Map((staffRows ?? []).map((s) => [normalize(s.name), s]));

    await syncClassSections(sheets, spreadsheetId, supabase, seenIds.class_sections, staffByName);
    const { data: classSectionRows } = await supabase
      .from("class_sections")
      .select("id, grade, section, academic_year");
    const classSectionByLabel = new Map(
      (classSectionRows ?? []).map((c) => [normalize(classSectionLabel(c)), c])
    );

    await syncSubjects(sheets, spreadsheetId, supabase, seenIds.subjects);
    const { data: subjectRows } = await supabase.from("subjects").select("id, name");
    const subjectByName = new Map((subjectRows ?? []).map((s) => [normalize(s.name), s]));

    await syncStudents(sheets, spreadsheetId, supabase, seenIds.students, classSectionByLabel);
    const { data: studentRows } = await supabase.from("students").select("id, roll_no");
    const studentIdsByRollNo = new Map<string, string[]>();
    for (const s of studentRows ?? []) {
      const key = cell(s.roll_no);
      studentIdsByRollNo.set(key, [...(studentIdsByRollNo.get(key) ?? []), s.id]);
    }

    await syncGuardians(sheets, spreadsheetId, supabase, seenIds.guardians, studentIdsByRollNo);

    const { data: periodRows } = await supabase
      .from("timetable_periods")
      .select("id, label, position");
    await syncTimetable(
      sheets,
      spreadsheetId,
      supabase,
      seenIds.timetable_entries,
      classSectionByLabel,
      subjectByName,
      staffByName,
      periodRows ?? []
    );

    await queuePendingDeletions(supabase, seenIds);

    await supabase
      .from("sheet_sync_runs")
      .update({ finished_at: new Date().toISOString(), status: "success" })
      .eq("id", runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[google-sheets] sync failed:", err);
    try {
      if (runId) {
        await supabase
          .from("sheet_sync_runs")
          .update({ finished_at: new Date().toISOString(), status: "failed", error_summary: message })
          .eq("id", runId);
      } else {
        // Couldn't even create the run row — still leave a completed record.
        await supabase
          .from("sheet_sync_runs")
          .insert({ finished_at: new Date().toISOString(), status: "failed", error_summary: message });
      }
    } catch (innerErr) {
      console.error("[google-sheets] failed to record failed sync run:", innerErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-tab processors. Each reads its tab, applies inserts/updates row by row
// (a per-row failure is written to that row's Sync Status cell and does not
// abort the tab), and writes id + status cells back in one batchUpdate.
// ---------------------------------------------------------------------------

async function syncTeachers(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  supabase: AdminClient,
  seen: Set<string>
) {
  const tab: TabName = "Teachers";
  const rows = await readTab(sheets, spreadsheetId, tab);
  const updates: sheets_v4.Schema$ValueRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;
    if (!row?.some((c) => cell(c))) continue;
    try {
      const [idRaw, nameRaw, roleRaw, phoneRaw] = row;
      const id = cell(idRaw);
      const name = cell(nameRaw);
      const role = cell(roleRaw) as Enums<"role">;
      const phone = cell(phoneRaw);

      if (!name || !phone) {
        updates.push(statusCell(tab, sheetRow, "Error: name and phone are required"));
        continue;
      }
      if (!ROLE_VALUES.includes(role)) {
        updates.push(statusCell(tab, sheetRow, `Error: role "${roleRaw}" is not a valid role`));
        continue;
      }

      const payload = { name, role, phone };
      if (id) {
        const { error } = await supabase.from("staff").update(payload).eq("id", id);
        if (error) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error.message}`));
          continue;
        }
        seen.add(id);
      } else {
        const { data: inserted, error } = await supabase
          .from("staff")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error?.message ?? "insert failed"}`));
          continue;
        }
        seen.add(inserted.id);
        updates.push(idCell(tab, sheetRow, inserted.id));
      }
      updates.push(statusCell(tab, sheetRow, "OK"));
    } catch (e) {
      updates.push(statusCell(tab, sheetRow, `Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}

async function syncClassSections(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  supabase: AdminClient,
  seen: Set<string>,
  staffByName: Map<string, { id: string; name: string; role: Enums<"role"> }>
) {
  const tab: TabName = "ClassSections";
  const rows = await readTab(sheets, spreadsheetId, tab);
  const updates: sheets_v4.Schema$ValueRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;
    if (!row?.some((c) => cell(c))) continue;
    try {
      const [idRaw, academicYearRaw, gradeRaw, sectionRaw, teacherNameRaw] = row;
      const id = cell(idRaw);
      const academic_year = cell(academicYearRaw);
      const grade = cell(gradeRaw);
      const section = cell(sectionRaw);
      const teacherName = cell(teacherNameRaw);

      if (!academic_year || !grade || !section) {
        updates.push(statusCell(tab, sheetRow, "Error: academic_year, grade and section are required"));
        continue;
      }
      let class_teacher_id: string | null = null;
      if (teacherName) {
        const match = staffByName.get(normalize(teacherName));
        if (!match) {
          updates.push(statusCell(tab, sheetRow, `Error: class teacher "${teacherName}" not found`));
          continue;
        }
        class_teacher_id = match.id;
      }

      const payload = { academic_year, grade, section, class_teacher_id };
      if (id) {
        const { error } = await supabase.from("class_sections").update(payload).eq("id", id);
        if (error) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error.message}`));
          continue;
        }
        seen.add(id);
      } else {
        const { data: inserted, error } = await supabase
          .from("class_sections")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error?.message ?? "insert failed"}`));
          continue;
        }
        seen.add(inserted.id);
        updates.push(idCell(tab, sheetRow, inserted.id));
      }
      updates.push(statusCell(tab, sheetRow, "OK"));
    } catch (e) {
      updates.push(statusCell(tab, sheetRow, `Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}

async function syncSubjects(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  supabase: AdminClient,
  seen: Set<string>
) {
  const tab: TabName = "Subjects";
  const rows = await readTab(sheets, spreadsheetId, tab);
  const updates: sheets_v4.Schema$ValueRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;
    if (!row?.some((c) => cell(c))) continue;
    try {
      const [idRaw, nameRaw] = row;
      const id = cell(idRaw);
      const name = cell(nameRaw);
      if (!name) {
        updates.push(statusCell(tab, sheetRow, "Error: name is required"));
        continue;
      }

      if (id) {
        const { error } = await supabase.from("subjects").update({ name }).eq("id", id);
        if (error) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error.message}`));
          continue;
        }
        seen.add(id);
      } else {
        const { data: inserted, error } = await supabase
          .from("subjects")
          .insert({ name })
          .select("id")
          .single();
        if (error || !inserted) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error?.message ?? "insert failed"}`));
          continue;
        }
        seen.add(inserted.id);
        updates.push(idCell(tab, sheetRow, inserted.id));
      }
      updates.push(statusCell(tab, sheetRow, "OK"));
    } catch (e) {
      updates.push(statusCell(tab, sheetRow, `Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}

async function syncStudents(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  supabase: AdminClient,
  seen: Set<string>,
  classSectionByLabel: Map<string, { id: string; grade: string; section: string; academic_year: string }>
) {
  const tab: TabName = "Students";
  const rows = await readTab(sheets, spreadsheetId, tab);
  const updates: sheets_v4.Schema$ValueRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;
    if (!row?.some((c) => cell(c))) continue;
    try {
      const [idRaw, firstRaw, lastRaw, rollRaw, classLabelRaw, photoRaw] = row;
      const id = cell(idRaw);
      const first_name = cell(firstRaw);
      const last_name = cell(lastRaw);
      const roll_no = cell(rollRaw);
      const classLabel = cell(classLabelRaw);
      const photo_url = cell(photoRaw) || null;

      if (!first_name || !last_name || !roll_no || !classLabel) {
        updates.push(
          statusCell(tab, sheetRow, "Error: first_name, last_name, roll_no and class_section are required")
        );
        continue;
      }
      const classSection = classSectionByLabel.get(normalize(classLabel));
      if (!classSection) {
        updates.push(statusCell(tab, sheetRow, `Error: class section "${classLabel}" not found`));
        continue;
      }

      const payload = { first_name, last_name, roll_no, class_section_id: classSection.id, photo_url };
      if (id) {
        const { error } = await supabase.from("students").update(payload).eq("id", id);
        if (error) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error.message}`));
          continue;
        }
        seen.add(id);
      } else {
        const { data: inserted, error } = await supabase
          .from("students")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error?.message ?? "insert failed"}`));
          continue;
        }
        seen.add(inserted.id);
        updates.push(idCell(tab, sheetRow, inserted.id));
      }
      updates.push(statusCell(tab, sheetRow, "OK"));
    } catch (e) {
      updates.push(statusCell(tab, sheetRow, `Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}

async function syncGuardians(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  supabase: AdminClient,
  seen: Set<string>,
  studentIdsByRollNo: Map<string, string[]>
) {
  const tab: TabName = "Guardians";
  const rows = await readTab(sheets, spreadsheetId, tab);
  const updates: sheets_v4.Schema$ValueRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;
    if (!row?.some((c) => cell(c))) continue;
    try {
      const [idRaw, nameRaw, relationRaw, phoneRaw, emailRaw, linkedRaw] = row;
      const id = cell(idRaw);
      const name = cell(nameRaw);
      const relation = cell(relationRaw);
      const phone = cell(phoneRaw);
      const email = cell(emailRaw) || null;
      const rollNos = cell(linkedRaw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!name || !relation || !phone) {
        updates.push(statusCell(tab, sheetRow, "Error: name, relation and phone are required"));
        continue;
      }

      const studentIds: string[] = [];
      let resolutionError: string | null = null;
      for (const rollNo of rollNos) {
        const matches = studentIdsByRollNo.get(rollNo) ?? [];
        if (matches.length === 0) {
          resolutionError = `Error: no student with roll_no "${rollNo}"`;
          break;
        }
        if (matches.length > 1) {
          resolutionError = `Error: roll_no "${rollNo}" matches more than one student`;
          break;
        }
        studentIds.push(matches[0]);
      }
      if (resolutionError) {
        updates.push(statusCell(tab, sheetRow, resolutionError));
        continue;
      }

      const payload = { name, relation, phone, email };
      let guardianId = id;
      if (id) {
        const { error } = await supabase.from("guardians").update(payload).eq("id", id);
        if (error) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error.message}`));
          continue;
        }
        await supabase.from("guardian_student").delete().eq("guardian_id", id);
        seen.add(id);
      } else {
        const { data: inserted, error } = await supabase
          .from("guardians")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error?.message ?? "insert failed"}`));
          continue;
        }
        guardianId = inserted.id;
        seen.add(inserted.id);
        updates.push(idCell(tab, sheetRow, inserted.id));
      }

      if (studentIds.length) {
        const { error: linkError } = await supabase
          .from("guardian_student")
          .insert(studentIds.map((student_id) => ({ guardian_id: guardianId, student_id })));
        if (linkError) {
          updates.push(statusCell(tab, sheetRow, `Error linking students: ${linkError.message}`));
          continue;
        }
      }
      updates.push(statusCell(tab, sheetRow, "OK"));
    } catch (e) {
      updates.push(statusCell(tab, sheetRow, `Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}

function resolvePeriod(
  raw: string,
  periods: { id: string; label: string; position: number }[]
): { id: string } | null {
  if (!raw) return null;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) {
    const byPosition = periods.find((p) => p.position === asNumber);
    if (byPosition) return byPosition;
  }
  const byLabel = periods.find((p) => p.label.toLowerCase() === raw.toLowerCase());
  return byLabel ?? null;
}

async function syncTimetable(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  supabase: AdminClient,
  seen: Set<string>,
  classSectionByLabel: Map<string, { id: string }>,
  subjectByName: Map<string, { id: string }>,
  staffByName: Map<string, { id: string }>,
  periods: { id: string; label: string; position: number }[]
) {
  const tab: TabName = "Timetable";
  const rows = await readTab(sheets, spreadsheetId, tab);
  const updates: sheets_v4.Schema$ValueRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;
    if (!row?.some((c) => cell(c))) continue;
    try {
      const [idRaw, classLabelRaw, subjectRaw, dayRaw, periodRaw, teacherRaw] = row;
      const id = cell(idRaw);
      const classLabel = cell(classLabelRaw);
      const subjectName = cell(subjectRaw);
      const dayOfWeek = Number(cell(dayRaw));
      const periodRawTrimmed = cell(periodRaw);
      const teacherName = cell(teacherRaw);

      if (!classLabel || !periodRawTrimmed || !Number.isFinite(dayOfWeek)) {
        updates.push(statusCell(tab, sheetRow, "Error: class_section, day_of_week and period are required"));
        continue;
      }
      if (dayOfWeek < 1 || dayOfWeek > 6) {
        updates.push(statusCell(tab, sheetRow, "Error: day_of_week must be between 1 (Mon) and 6 (Sat)"));
        continue;
      }
      const classSection = classSectionByLabel.get(normalize(classLabel));
      if (!classSection) {
        updates.push(statusCell(tab, sheetRow, `Error: class section "${classLabel}" not found`));
        continue;
      }
      const period = resolvePeriod(periodRawTrimmed, periods);
      if (!period) {
        updates.push(statusCell(tab, sheetRow, `Error: period "${periodRawTrimmed}" not found`));
        continue;
      }
      let subject_id: string | null = null;
      if (subjectName) {
        const subject = subjectByName.get(normalize(subjectName));
        if (!subject) {
          updates.push(statusCell(tab, sheetRow, `Error: subject "${subjectName}" not found`));
          continue;
        }
        subject_id = subject.id;
      }
      let teacher_id: string | null = null;
      if (teacherName) {
        const teacher = staffByName.get(normalize(teacherName));
        if (!teacher) {
          updates.push(statusCell(tab, sheetRow, `Error: teacher "${teacherName}" not found`));
          continue;
        }
        teacher_id = teacher.id;
      }

      const payload = {
        class_section_id: classSection.id,
        day_of_week: dayOfWeek,
        period_id: period.id,
        subject_id,
        teacher_id,
        updated_at: new Date().toISOString(),
      };
      if (id) {
        const { error } = await supabase.from("timetable_entries").update(payload).eq("id", id);
        if (error) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error.message}`));
          continue;
        }
        seen.add(id);
      } else {
        const { data: inserted, error } = await supabase
          .from("timetable_entries")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) {
          updates.push(statusCell(tab, sheetRow, `Error: ${error?.message ?? "insert failed"}`));
          continue;
        }
        seen.add(inserted.id);
        updates.push(idCell(tab, sheetRow, inserted.id));
      }
      updates.push(statusCell(tab, sheetRow, "OK"));
    } catch (e) {
      updates.push(statusCell(tab, sheetRow, `Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}

// ---------------------------------------------------------------------------
// Pending deletions — a Postgres row whose id wasn't seen in this sync pass
// (present in the DB, missing from the sheet) is queued for a super_admin to
// confirm, instead of being auto-deleted. Skips rows already queued.
// ---------------------------------------------------------------------------

const TABLES_FOR_DELETION_CHECK = [
  "staff",
  "class_sections",
  "subjects",
  "students",
  "guardians",
  "timetable_entries",
] as const;

async function queuePendingDeletions(supabase: AdminClient, seenIds: Record<string, Set<string>>) {
  const { data: alreadyQueued } = await supabase
    .from("sheet_sync_pending_deletions")
    .select("subject_type, subject_id")
    .is("resolved_at", null);
  const queuedKey = new Set((alreadyQueued ?? []).map((r) => `${r.subject_type}:${r.subject_id}`));

  for (const table of TABLES_FOR_DELETION_CHECK) {
    const { data: rows } = await supabase.from(table).select("*");
    const subjectType = table;
    const missing = (rows ?? []).filter(
      (row) => !seenIds[table].has((row as { id: string }).id)
    );
    for (const row of missing) {
      const subjectId = (row as { id: string }).id;
      const key = `${subjectType}:${subjectId}`;
      if (queuedKey.has(key)) continue;
      await supabase.from("sheet_sync_pending_deletions").insert({
        subject_type: subjectType,
        subject_id: subjectId,
        sheet_row_snapshot: row as never,
      });
      queuedKey.add(key);
    }
  }
}

// ---------------------------------------------------------------------------
// One-time provisioning: create the spreadsheet (unless GOOGLE_SHEETS_SPREADSHEET_ID
// is already set), write tab names + header rows, and share it with every
// principal/super_admin staff member.
// ---------------------------------------------------------------------------

export async function provisionSheet(): Promise<{ spreadsheetId: string; url: string }> {
  const existingId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheets = getSheetsClient();
  let spreadsheetId = existingId ?? null;

  if (!spreadsheetId) {
    const { data: created } = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Manthan Parent Portal — Roster & Academic Config" },
        sheets: TAB_NAMES.map((name) => ({ properties: { title: name } })),
      },
    });
    if (!created.spreadsheetId) throw new Error("Google Sheets did not return a spreadsheetId");
    spreadsheetId = created.spreadsheetId;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: TAB_NAMES.map((name) => ({
          range: `${name}!A1`,
          values: [[...TAB_HEADERS[name]]],
        })),
      },
    });
  }

  const supabase = createAdminClient();
  const { data: staffRows, error } = await supabase
    .from("staff")
    .select("email, name, role")
    .in("role", ["principal", "super_admin"]);
  if (error) throw new Error(error.message);

  const drive = getDriveClient();
  const recipients = (staffRows ?? []).filter((s) => s.email);
  for (const recipient of recipients) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: false,
        requestBody: { type: "user", role: "writer", emailAddress: recipient.email! },
      });
    } catch (e) {
      console.error(`[google-sheets] failed to share spreadsheet with ${recipient.email}:`, e);
    }
  }

  return { spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}
