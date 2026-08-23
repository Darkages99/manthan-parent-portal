"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrincipal } from "@/lib/roles";
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
