// Idempotent top-up for the demo dataset: (re)plants "today"-dated rows so the
// principal/staff dashboard shows a busy day — absentees, stay-backs, homework
// outstanding, and staff alerts — regardless of how long ago `npm run demo:seed`
// was originally run (all of that data is date-relative to *seed time*, not
// *today*, so it goes stale the moment a day passes).
//
// Safe to re-run: every row is upserted, keyed off today's date, so running
// this twice in one day is a no-op the second time, and running it on a new
// day plants a fresh set without duplicating older days' rows.
//
// Run with: npm run demo:refresh-today   (uses node --env-file=.env.local)
import { supabase, batchUpsert } from "./lib/supabase.mjs";
import { demoId } from "./lib/ids.mjs";

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function main() {
  console.log(`== Refreshing demo "today" data for ${today} ==`);

  const { data: classes, error: classesError } = await supabase
    .from("class_sections")
    .select("id, grade, section, class_teacher_id")
    .eq("academic_year", "DEMO 2026-27")
    .order("grade")
    .order("section");
  if (classesError) throw new Error(classesError.message);
  if (!classes || classes.length === 0) {
    throw new Error('No demo classes found (academic_year = "DEMO 2026-27"). Run `npm run demo:seed` first.');
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, first_name, last_name, class_section_id")
    .in("class_section_id", classes.map((c) => c.id))
    .order("class_section_id")
    .order("roll_no");
  if (studentsError) throw new Error(studentsError.message);

  const studentsByClass = new Map();
  for (const s of students) {
    (studentsByClass.get(s.class_section_id) ?? studentsByClass.set(s.class_section_id, []).get(s.class_section_id)).push(s);
  }
  const rosterFor = (classId) => studentsByClass.get(classId) ?? [];

  // --- Pick disjoint scenario pools from the first handful of classes ----
  const c = classes;
  const absentNoLeave = [rosterFor(c[0].id)[0], rosterFor(c[3].id)[0], rosterFor(c[6].id)[0], rosterFor(c[9].id)[0], rosterFor(c[12].id)[0]].filter(Boolean);
  const absentWithLeave = [rosterFor(c[1].id)[1], rosterFor(c[4].id)[1]].filter(Boolean);
  const stayingBackToday = [
    ...rosterFor(c[2].id).slice(2, 5),
    ...rosterFor(c[5].id).slice(2, 5),
    ...rosterFor(c[8].id).slice(2, 4),
  ].filter(Boolean);
  const homeworkClasses = [c[0], c[1], c[13]].filter(Boolean);
  const staffAlertTeachers = [c[20], c[21]].filter(Boolean).map((cs) => cs.class_teacher_id);

  const guardianNeededIds = [...absentWithLeave, ...stayingBackToday].map((s) => s.id);
  const { data: guardianLinks, error: guardianLinksError } = await supabase
    .from("guardian_student")
    .select("student_id, guardian_id")
    .in("student_id", guardianNeededIds);
  if (guardianLinksError) throw new Error(guardianLinksError.message);
  const guardianByStudent = new Map(guardianLinks.map((g) => [g.student_id, g.guardian_id]));

  // --- Absent today ------------------------------------------------------
  console.log(`Absent today: ${absentNoLeave.length} uncovered + ${absentWithLeave.length} on approved leave`);
  const attendanceRows = [...absentNoLeave, ...absentWithLeave].map((s) => ({
    id: demoId("today-attendance", `${s.id}:${today}`),
    student_id: s.id,
    date: today,
    status: "absent",
    marked_by: classes.find((cs) => cs.id === s.class_section_id)?.class_teacher_id ?? null,
  }));
  await batchUpsert("attendance_records", attendanceRows, "student_id,date");

  const leaveRows = absentWithLeave.map((s) => ({
    id: demoId("today-leave", `${s.id}:${today}`),
    student_id: s.id,
    requested_by: guardianByStudent.get(s.id),
    from_date: today,
    to_date: today,
    reason: "Not feeling well",
    status: "approved",
    decided_by: classes.find((cs) => cs.id === s.class_section_id)?.class_teacher_id ?? null,
    decided_at: new Date().toISOString(),
  }));
  await batchUpsert("leave_requests", leaveRows, "id");

  // --- Staying back today (fully approved) --------------------------------
  console.log(`Staying back today: ${stayingBackToday.length} students`);
  const stayBackRows = stayingBackToday.map((s) => ({
    id: demoId("today-staybak", `${s.id}:${today}`),
    student_id: s.id,
    raised_by_guardian_id: guardianByStudent.get(s.id),
    teacher_id: classes.find((cs) => cs.id === s.class_section_id)?.class_teacher_id ?? null,
    reason: "Extra coaching class",
    stay_date: today,
    from_time: "15:15:00",
    to_time: "16:15:00",
    status: "approved",
    teacher_decision: "approved",
    teacher_decided_at: new Date().toISOString(),
    principal_decision: "approved",
    principal_decided_at: new Date().toISOString(),
  }));
  await batchUpsert("stay_back_consents", stayBackRows, "id");

  // --- Homework due today, some not marked done ---------------------------
  console.log(`Homework due today: ${homeworkClasses.length} classes`);
  const homeworkRows = homeworkClasses.map((cs) => ({
    id: demoId("today-hw", `${cs.id}:${today}`),
    class_section_id: cs.id,
    subject_id: null,
    teacher_id: cs.class_teacher_id,
    title: "Complete worksheet and revise chapter",
    description: null,
    due_date: today,
    checked: false,
  }));
  await batchUpsert("homework_assignments", homeworkRows, "id");

  // checked = false, so a homework_submissions row marks that student as the
  // exception who has NOT done it (see console-alerts.ts: done = checked ?
  // overridden : !overridden) — insert rows only for the "not done" students.
  const notDoneRows = [];
  homeworkRows.forEach((hw, i) => {
    const roster = rosterFor(homeworkClasses[i].id);
    const notDone = roster.slice(0, Math.max(1, Math.ceil(roster.length * 0.35)));
    for (const s of notDone) {
      notDoneRows.push({
        id: demoId("today-hw-sub", `${hw.id}:${s.id}`),
        homework_id: hw.id,
        student_id: s.id,
      });
    }
  });
  await batchUpsert("homework_submissions", notDoneRows, "homework_id,student_id");

  // --- Staff reassignment alerts ------------------------------------------
  console.log(`Staff alerts: ${staffAlertTeachers.length}`);
  const staffAlertRows = staffAlertTeachers.map((staffId, i) => ({
    id: demoId("today-staffalert", `${staffId}:${today}`),
    staff_id: staffId,
    message:
      i === 0
        ? "This teacher was deactivated while still assigned as class teacher — reassign the class."
        : "This teacher was deactivated while still holding a subject assignment — reassign the subject.",
    resolved: false,
    created_at: new Date().toISOString(),
  }));
  await batchUpsert("staff_reassignment_alerts", staffAlertRows, "id");

  console.log("\n== Done — refresh again any day to re-plant today's scenario. ==");
}

main().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
