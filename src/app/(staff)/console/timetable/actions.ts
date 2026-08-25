"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";
import { parseCsv } from "@/lib/csv";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Sets a single timetable cell for a class. Passing both subject and teacher as
 * null clears (deletes) the cell; otherwise the row is upserted on the unique
 * (class, day, period) key. Returns the saved row (or null when cleared) so the
 * client can update its grid without a full refetch.
 */
export async function upsertEntry(input: {
  classSectionId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId: string | null;
  teacherId: string | null;
}): Promise<Tables<"timetable_entries"> | null> {
  await requirePrincipal();
  const { classSectionId, dayOfWeek, periodId, subjectId, teacherId } = input;
  if (!classSectionId || !periodId) throw new Error("Class and period are required");
  if (dayOfWeek < 1 || dayOfWeek > 6) throw new Error("Invalid day");

  const supabase = await createClient();

  if (!subjectId && !teacherId) {
    const { error } = await supabase
      .from("timetable_entries")
      .delete()
      .eq("class_section_id", classSectionId)
      .eq("day_of_week", dayOfWeek)
      .eq("period_id", periodId);
    if (error) throw new Error(error.message);
    revalidatePath("/console/timetable");
    return null;
  }

  const { data, error } = await supabase
    .from("timetable_entries")
    .upsert(
      {
        class_section_id: classSectionId,
        day_of_week: dayOfWeek,
        period_id: periodId,
        subject_id: subjectId,
        teacher_id: teacherId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "class_section_id,day_of_week,period_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/console/timetable");
  return data;
}

/** Adds a period slot. Position is appended after the current last slot. */
export async function addPeriod(input: {
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}): Promise<Tables<"timetable_periods">> {
  await requirePrincipal();
  const { label, startTime, endTime, isBreak } = input;
  if (!label.trim()) throw new Error("Label is required");
  if (!startTime || !endTime) throw new Error("Start and end time are required");
  if (endTime <= startTime) throw new Error("End time must be after start time");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("timetable_periods")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("timetable_periods")
    .insert({ label: label.trim(), start_time: startTime, end_time: endTime, is_break: isBreak, position })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/console/timetable");
  updateTag("timetable-periods");
  return data;
}

/** Edits an existing period slot's label, times or break flag. */
export async function updatePeriod(input: {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}): Promise<Tables<"timetable_periods">> {
  await requirePrincipal();
  const { id, label, startTime, endTime, isBreak } = input;
  if (!id) throw new Error("Period is required");
  if (!label.trim()) throw new Error("Label is required");
  if (endTime <= startTime) throw new Error("End time must be after start time");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timetable_periods")
    .update({ label: label.trim(), start_time: startTime, end_time: endTime, is_break: isBreak })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/console/timetable");
  updateTag("timetable-periods");
  return data;
}

/**
 * Bulk-imports timetable cells from a CSV. Expected header columns:
 * class_section, day_of_week, period, subject, teacher — where class_section
 * is a "Grade {grade}-{section}" label, day_of_week is 1 (Mon) through 6
 * (Sat), and period is either a period label or its position number.
 * subject/teacher are matched by name and may be left blank to clear a cell.
 * Each row is applied independently; a bad row is reported but doesn't abort
 * the rest of the file.
 */
export async function importTimetableCsv(
  csvText: string
): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
  await requirePrincipal();
  const supabase = await createClient();

  const { header, rows } = parseCsv(csvText);
  const col = (name: string) => header.findIndex((h) => h.toLowerCase().trim() === name);
  const classCol = col("class_section");
  const dayCol = col("day_of_week");
  const periodCol = col("period");
  const subjectCol = col("subject");
  const teacherCol = col("teacher");
  if (classCol === -1 || dayCol === -1 || periodCol === -1) {
    throw new Error(
      "CSV must have class_section, day_of_week and period columns (subject and teacher are optional)."
    );
  }

  const [{ data: classes }, { data: periods }, { data: subjects }, { data: teachers }] =
    await Promise.all([
      supabase.from("class_sections").select("id, grade, section"),
      supabase.from("timetable_periods").select("id, label, position"),
      supabase.from("subjects").select("id, name"),
      supabase.from("staff").select("id, name"),
    ]);

  const norm = (s: string) => s.trim().toLowerCase();
  const classByLabel = new Map(
    (classes ?? []).map((c) => [norm(`grade ${c.grade}-${c.section}`), c])
  );
  const subjectByName = new Map((subjects ?? []).map((s) => [norm(s.name), s]));
  const teacherByName = new Map((teachers ?? []).map((t) => [norm(t.name), t]));
  function resolvePeriod(raw: string) {
    const asNumber = Number(raw);
    if (!Number.isNaN(asNumber)) {
      const byPosition = (periods ?? []).find((p) => p.position === asNumber);
      if (byPosition) return byPosition;
    }
    return (periods ?? []).find((p) => norm(p.label) === norm(raw)) ?? null;
  }

  const errors: { row: number; message: string }[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +1 for header, +1 for 1-based
    const cell = (idx: number) => (idx === -1 ? "" : (rows[i][idx] ?? "").trim());
    try {
      const classLabel = cell(classCol);
      const dayOfWeek = Number(cell(dayCol));
      const periodRaw = cell(periodCol);
      const subjectName = cell(subjectCol);
      const teacherName = cell(teacherCol);

      if (!classLabel || !periodRaw || !Number.isFinite(dayOfWeek)) {
        errors.push({ row: rowNum, message: "class_section, day_of_week and period are required" });
        continue;
      }
      if (dayOfWeek < 1 || dayOfWeek > 6) {
        errors.push({ row: rowNum, message: "day_of_week must be between 1 (Mon) and 6 (Sat)" });
        continue;
      }
      const classSection = classByLabel.get(norm(classLabel));
      if (!classSection) {
        errors.push({ row: rowNum, message: `Class "${classLabel}" not found` });
        continue;
      }
      const period = resolvePeriod(periodRaw);
      if (!period) {
        errors.push({ row: rowNum, message: `Period "${periodRaw}" not found` });
        continue;
      }
      let subject_id: string | null = null;
      if (subjectName) {
        const subject = subjectByName.get(norm(subjectName));
        if (!subject) {
          errors.push({ row: rowNum, message: `Subject "${subjectName}" not found` });
          continue;
        }
        subject_id = subject.id;
      }
      let teacher_id: string | null = null;
      if (teacherName) {
        const teacher = teacherByName.get(norm(teacherName));
        if (!teacher) {
          errors.push({ row: rowNum, message: `Teacher "${teacherName}" not found` });
          continue;
        }
        teacher_id = teacher.id;
      }

      if (!subject_id && !teacher_id) {
        const { error } = await supabase
          .from("timetable_entries")
          .delete()
          .eq("class_section_id", classSection.id)
          .eq("day_of_week", dayOfWeek)
          .eq("period_id", period.id);
        if (error) {
          errors.push({ row: rowNum, message: error.message });
          continue;
        }
      } else {
        const { error } = await supabase.from("timetable_entries").upsert(
          {
            class_section_id: classSection.id,
            day_of_week: dayOfWeek,
            period_id: period.id,
            subject_id,
            teacher_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "class_section_id,day_of_week,period_id" }
        );
        if (error) {
          errors.push({ row: rowNum, message: error.message });
          continue;
        }
      }
      imported++;
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : String(e) });
    }
  }

  revalidatePath("/console/timetable");
  return { imported, errors };
}

/** Removes a period slot. Cascades to any timetable cells using it. */
export async function deletePeriod(id: string) {
  await requirePrincipal();
  if (!id) throw new Error("Period is required");

  const supabase = await createClient();
  const { error } = await supabase.from("timetable_periods").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/console/timetable");
  updateTag("timetable-periods");
}
