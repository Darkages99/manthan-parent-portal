// Manthan Parent Portal — massive-scale isolated demo dataset.
//
// Every row this script inserts has a primary-key uuid starting with the
// hex-valid literal "5eed0000" (see lib/ids.mjs). Nothing else in the
// database ever gets that prefix, so `npm run demo:teardown` can delete
// everything this script created without touching the pre-existing
// hand-written placeholder seed (supabase/seed.sql, ids a0/b0/c0/d0...).
//
// Run with `npm run demo:seed` (uses `node --env-file=.env.local`).

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "./lib/rng.mjs";
import { demoId, DEMO_PREFIX } from "./lib/ids.mjs";
import { fullName, makeEmail, makePhone } from "./lib/names.mjs";
import { supabase, batchInsert } from "./lib/supabase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rng = makeRng(20260729);

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTIONS = ["A", "B", "C"];
const ACADEMIC_YEAR = "DEMO 2026-27";

const CORE_SUBJECTS = ["Maths", "English", "Science", "Social Studies", "Hindi"];
const SPECIALIST_SUBJECTS = ["Second Language", "Computer", "Physical Education", "Art"];
const WEEKLY_TARGET = {
  Maths: 9, English: 8, Science: 7, "Social Studies": 6, Hindi: 7,
  "Second Language": 5, Computer: 4, "Physical Education": 4, Art: 4,
};
const SPECIALIST_STAFF_COUNT = { "Second Language": 4, Computer: 3, "Physical Education": 3, Art: 3 };

const TERMS = ["Term 1", "Term 2"];
const DEMO_PASSWORD = "Demo@1234";
const DEMO_EMAIL_DOMAIN = "manthan-demo.test";

function gradeFor(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C+";
  if (pct >= 40) return "C";
  if (pct >= 33) return "D";
  if (pct >= 20) return "E";
  return "F";
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

async function main() {
  console.log("== Manthan demo seed ==");

  // --- Idempotency guard -----------------------------------------------
  const { data: existing } = await supabase
    .from("class_sections")
    .select("id")
    .eq("academic_year", ACADEMIC_YEAR)
    .limit(1);
  if (existing && existing.length > 0) {
    console.error(
      `Demo data already present (class_sections.academic_year = '${ACADEMIC_YEAR}' exists). ` +
        "Run `npm run demo:teardown` first if you want to regenerate."
    );
    process.exit(1);
  }

  // --- Reference data already seeded by migration 0008 ------------------
  const { data: subjectRows } = await supabase.from("subjects").select("id,name");
  const subjectIdByName = Object.fromEntries(subjectRows.map((s) => [s.name, s.id]));
  const { data: periodRows } = await supabase
    .from("timetable_periods")
    .select("id,position,label,is_break")
    .order("position");
  const nonBreakPeriods = periodRows.filter((p) => !p.is_break);
  console.log(`Reference: ${subjectRows.length} subjects, ${nonBreakPeriods.length} teaching periods/day.`);

  // =======================================================================
  // 1. STAFF
  // =======================================================================
  const staffList = [];
  function addStaff(key, role) {
    const gender = rng.pick(["male", "female"]);
    const { first, last } = fullName(rng, gender);
    const id = demoId("staff", key);
    staffList.push({ id, name: `${first} ${last}`, role, phone: makePhone(rng), auth_user_id: null, _key: key });
    return id;
  }

  const principalId = addStaff("principal", "principal");
  const superAdminId = addStaff("super_admin", "super_admin");
  const frontOfficeIds = [addStaff("front_office-1", "front_office"), addStaff("front_office-2", "front_office")];
  const accountsIds = [addStaff("accounts-1", "accounts"), addStaff("accounts-2", "accounts")];

  const classKeys = [];
  for (const grade of GRADES) for (const section of SECTIONS) classKeys.push(`${grade}${section}`);

  const classTeacherIdByClassKey = {};
  for (const key of classKeys) classTeacherIdByClassKey[key] = addStaff(`class_teacher-${key}`, "class_teacher");

  const specialistIdsBySubject = {};
  for (const subject of SPECIALIST_SUBJECTS) {
    specialistIdsBySubject[subject] = [];
    for (let i = 1; i <= SPECIALIST_STAFF_COUNT[subject]; i += 1) {
      specialistIdsBySubject[subject].push(addStaff(`specialist-${subject}-${i}`, "class_teacher"));
    }
  }
  console.log(`Staff generated: ${staffList.length}`);

  // =======================================================================
  // 2. CLASS SECTIONS
  // =======================================================================
  const classSectionList = classKeys.map((key) => {
    const grade = key.slice(0, -1);
    const section = key.slice(-1);
    return {
      id: demoId("class", key),
      academic_year: ACADEMIC_YEAR,
      grade,
      section,
      class_teacher_id: classTeacherIdByClassKey[key],
      _key: key,
    };
  });
  const classIdByKey = Object.fromEntries(classSectionList.map((c) => [c._key, c.id]));

  // "1A" and "10C" are hardcoded elsewhere as the primary/senior demo
  // classes (teacher-primary, teacher-senior, parent-primary-grade,
  // parent-senior-grade logins) — reserve them so the randomly-chosen
  // scenario classes below never collide with them.
  const RESERVED_CLASSES = new Set(["1A", "10C"]);

  // One class gets a deliberately low average (analytics edge case).
  const lowAverageClassKey = rng.pick(classKeys.filter((k) => !RESERVED_CLASSES.has(k)));

  // =======================================================================
  // 3. STUDENTS
  // =======================================================================
  const studentList = [];
  for (const cs of classSectionList) {
    const size = rng.int(25, 32);
    for (let i = 1; i <= size; i += 1) {
      const gender = rng.pick(["male", "female"]);
      const { first, last } = fullName(rng, gender);
      const id = demoId("student", `${cs._key}-${i}`);
      studentList.push({
        id,
        first_name: first,
        last_name: last,
        roll_no: String(i).padStart(2, "0"),
        class_section_id: cs.id,
        classKey: cs._key,
      });
    }
  }
  console.log(`Students generated: ${studentList.length} across ${classSectionList.length} classes`);

  const studentsByClass = {};
  for (const s of studentList) (studentsByClass[s.classKey] ??= []).push(s);

  // =======================================================================
  // 4. ABILITY + HERO SCENARIO TAGGING
  // =======================================================================
  const abilityByStudent = {};
  for (const s of studentList) {
    const offset = s.classKey === lowAverageClassKey ? -0.18 : 0;
    abilityByStudent[s.id] = clamp(rng.float() * 0.5 + 0.45 + offset, 0.15, 0.98);
  }

  const topPerformerByClass = {};
  const atRiskByClass = {};
  const failingSubjectFor = {};
  for (const key of classKeys) {
    const roster = studentsByClass[key];
    const sortedByAbility = [...roster].sort((a, b) => abilityByStudent[b.id] - abilityByStudent[a.id]);
    topPerformerByClass[key] = sortedByAbility[0];
    const atRisk = sortedByAbility[sortedByAbility.length - 1];
    atRiskByClass[key] = atRisk;
    failingSubjectFor[atRisk.id] = rng.pick(CORE_SUBJECTS);
    abilityByStudent[atRisk.id] = clamp(abilityByStudent[atRisk.id], 0.15, 0.35);
  }
  const topPerformerIds = new Set(Object.values(topPerformerByClass).map((s) => s.id));
  const atRiskIds = new Set(Object.values(atRiskByClass).map((s) => s.id));
  const centumStudents = rng.sample(Object.values(topPerformerByClass), 15);
  const centumSubjectFor = {};
  for (const s of centumStudents) centumSubjectFor[s.id] = rng.pick(CORE_SUBJECTS);

  const notLowAttendancePool = rng.shuffle(studentList.filter((s) => !atRiskIds.has(s.id)));
  const lowAttendanceStudents = notLowAttendancePool.slice(0, 18);
  const lowAttendanceIds = new Set(lowAttendanceStudents.map((s) => s.id));

  const remainderPool = notLowAttendancePool.slice(18);
  const absentTodayWithLeave = remainderPool[0];
  const absentTodayNoLeave = remainderPool[1];

  const defaulterPool = rng.shuffle(studentList.filter((s) => s.id !== absentTodayWithLeave.id && s.id !== absentTodayNoLeave.id));
  const repeatDefaulter = defaulterPool[0];
  const singleDefaulters = defaulterPool.slice(1, 37);

  const leavePool = rng.shuffle(studentList);
  const pendingLeaveStudents = leavePool.slice(0, 20);
  const approvedLeaveStudents = leavePool.slice(20, 40);
  const declinedLeaveStudents = leavePool.slice(40, 55);

  const stayBackPool = rng.shuffle(studentList);
  const stayBackPending = stayBackPool.slice(0, 6);
  const stayBackTeacherPendingPrincipal = stayBackPool.slice(6, 12);
  const stayBackTeacherDeclined = stayBackPool.slice(12, 18);
  const stayBackBothApproved = stayBackPool.slice(18, 24);
  const stayBackPrincipalDeclined = stayBackPool.slice(24, 30);

  // Sibling households: ~40 pairs of students in different classes sharing guardians.
  const siblingOwner = new Map();
  for (const s of studentList) siblingOwner.set(s.id, s.id);
  const usedForPairing = new Set();
  const shuffledForPairing = rng.shuffle(studentList);
  const siblingPairs = [];
  for (const s of shuffledForPairing) {
    if (siblingPairs.length >= 40) break;
    if (usedForPairing.has(s.id)) continue;
    const partner = shuffledForPairing.find(
      (o) => !usedForPairing.has(o.id) && o.id !== s.id && o.classKey !== s.classKey
    );
    if (!partner) continue;
    usedForPairing.add(s.id);
    usedForPairing.add(partner.id);
    siblingOwner.set(partner.id, s.id);
    siblingPairs.push([s, partner]);
  }

  const openPtmDemoClass =
    classKeys.find((k) => k !== lowAverageClassKey && !RESERVED_CLASSES.has(k)) ?? classKeys[0];
  const remainingForCollision = classKeys.filter(
    (k) => k !== openPtmDemoClass && k !== lowAverageClassKey && !RESERVED_CLASSES.has(k)
  );
  const collisionClassA = remainingForCollision[0];
  const collisionClassB = remainingForCollision[1];

  console.log(
    `Scenarios: lowAvgClass=${lowAverageClassKey}, lowAttendance=${lowAttendanceStudents.length}, ` +
      `siblingPairs=${siblingPairs.length}, openPtmClass=${openPtmDemoClass}, collision=${collisionClassA}/${collisionClassB}`
  );

  // =======================================================================
  // 5. GUARDIANS (+ sibling sharing)
  // =======================================================================
  const guardianList = [];
  const guardianIdsByOwner = new Map();
  const householdOwners = [...new Set(studentList.map((s) => siblingOwner.get(s.id)))];
  for (const ownerId of householdOwners) {
    const ids = [];
    if (rng.chance(0.1)) {
      const relation = rng.pick(["Mother", "Father", "Guardian"]);
      const gender = relation === "Mother" ? "female" : relation === "Father" ? "male" : rng.pick(["male", "female"]);
      const { first, last } = fullName(rng, gender);
      const id = demoId("guardian", `${ownerId}:g1`);
      guardianList.push({
        id, name: `${first} ${last}`, relation, phone: makePhone(rng),
        email: rng.chance(0.5) ? makeEmail(first, last) : null, auth_user_id: null,
      });
      ids.push(id);
    } else {
      const { first: ff, last: fl } = fullName(rng, "male");
      const fatherId = demoId("guardian", `${ownerId}:father`);
      guardianList.push({
        id: fatherId, name: `${ff} ${fl}`, relation: "Father", phone: makePhone(rng),
        email: rng.chance(0.5) ? makeEmail(ff, fl) : null, auth_user_id: null,
      });
      ids.push(fatherId);
      const mf = fullName(rng, "female").first;
      const motherId = demoId("guardian", `${ownerId}:mother`);
      guardianList.push({
        id: motherId, name: `${mf} ${fl}`, relation: "Mother", phone: makePhone(rng),
        email: rng.chance(0.5) ? makeEmail(mf, fl) : null, auth_user_id: null,
      });
      ids.push(motherId);
    }
    guardianIdsByOwner.set(ownerId, ids);
  }
  const guardianStudentLinks = [];
  for (const s of studentList) {
    const owner = siblingOwner.get(s.id);
    for (const gid of guardianIdsByOwner.get(owner)) guardianStudentLinks.push({ guardian_id: gid, student_id: s.id });
  }
  console.log(`Guardians generated: ${guardianList.length} (${siblingPairs.length} sibling households merged)`);

  // =======================================================================
  // 6. LOGIN ROSTER — curated real auth.users
  // =======================================================================
  const guardianById = Object.fromEntries(guardianList.map((g) => [g.id, g]));
  const staffById = Object.fromEntries(staffList.map((s) => [s.id, s]));
  const credentialLines = [];

  // Several scenario picks above were chosen independently and can
  // coincidentally land on the same class/guardian (e.g. the randomly-picked
  // "open PTM" class happening to equal the hardcoded "primary grade" class).
  // Granting two logins to the same underlying staff/guardian row would
  // silently orphan the first login (auth_user_id gets overwritten by the
  // second). These claim-based pickers guarantee every login this script
  // grants maps to a distinct staff/guardian row.
  const claimedStaffIds = new Set([principalId, superAdminId, ...frontOfficeIds, ...accountsIds]);
  const claimedGuardianOwners = new Set();
  const shuffledClassKeys = rng.shuffle(classKeys);
  const shuffledStudents = rng.shuffle(studentList);

  function pickTeacher(classKeyCandidates) {
    for (const ck of [...classKeyCandidates, ...shuffledClassKeys]) {
      const staffId = classTeacherIdByClassKey[ck];
      if (!claimedStaffIds.has(staffId)) {
        claimedStaffIds.add(staffId);
        return { classKey: ck, staffId };
      }
    }
    throw new Error("pickTeacher: exhausted candidates");
  }

  function pickGuardianStudent(studentCandidates) {
    for (const s of [...studentCandidates, ...shuffledStudents]) {
      const owner = siblingOwner.get(s.id);
      if (!claimedGuardianOwners.has(owner)) {
        claimedGuardianOwners.add(owner);
        return s;
      }
    }
    throw new Error("pickGuardianStudent: exhausted candidates");
  }

  async function grantGuardianLogin(slug, scenario, student) {
    const ownerId = siblingOwner.get(student.id);
    const guardianId = guardianIdsByOwner.get(ownerId)[0];
    const guardian = guardianById[guardianId];
    const email = `demo.${slug}@${DEMO_EMAIL_DOMAIN}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: DEMO_PASSWORD, email_confirm: true,
      user_metadata: { demo: true, name: guardian.name, kind: "guardian" },
    });
    if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
    guardian.auth_user_id = data.user.id;
    guardian.email = email;
    credentialLines.push(
      `| Parent | ${guardian.name} | ${email} | ${DEMO_PASSWORD} | ${scenario} — child ${student.first_name} ${student.last_name} (${student.classKey}) |`
    );
    return guardianId;
  }

  async function grantStaffLogin(slug, staffId, scenario) {
    const staff = staffById[staffId];
    const email = `demo.${slug}@${DEMO_EMAIL_DOMAIN}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: DEMO_PASSWORD, email_confirm: true,
      user_metadata: { demo: true, name: staff.name, kind: "staff" },
    });
    if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
    staff.auth_user_id = data.user.id;
    credentialLines.push(`| Staff (${staff.role}) | ${staff.name} | ${email} | ${DEMO_PASSWORD} | ${scenario} |`);
  }

  console.log("Creating curated login accounts (auth.users)...");
  await grantStaffLogin("principal", principalId, "Principal — full-school console access, results/timetable edit rights");
  await grantStaffLogin("super-admin", superAdminId, "Super admin — same rights as principal");
  await grantStaffLogin("front-office", frontOfficeIds[0], "Front office staff — all-classes console view");
  await grantStaffLogin("accounts", accountsIds[0], "Accounts staff — all-classes console view");

  const tLowAttendance = pickTeacher(lowAttendanceStudents.map((s) => s.classKey));
  await grantStaffLogin("teacher-low-attendance", tLowAttendance.staffId, `Class teacher of ${tLowAttendance.classKey} — several low-attendance students to review`);
  const tStayBack = pickTeacher(stayBackPending.map((s) => s.classKey));
  await grantStaffLogin("teacher-stay-back", tStayBack.staffId, `Class teacher of ${tStayBack.classKey} — pending stay-back requests to decide`);
  const tOpenPtm = pickTeacher([openPtmDemoClass]);
  await grantStaffLogin("teacher-open-ptm", tOpenPtm.staffId, `Class teacher of ${tOpenPtm.classKey} — open PTM meeting with free slots`);
  const tCollision = pickTeacher([collisionClassA]);
  await grantStaffLogin("teacher-collision-a", tCollision.staffId, `Class teacher of ${tCollision.classKey} — timetable has a planted teacher double-booking to spot`);
  const tLowAverage = pickTeacher([lowAverageClassKey]);
  await grantStaffLogin("teacher-low-average", tLowAverage.staffId, `Class teacher of ${tLowAverage.classKey} — deliberately low class exam average`);
  const tPrimary = pickTeacher(["1A"]);
  await grantStaffLogin("teacher-primary", tPrimary.staffId, "Class teacher of 1A — primary grade view");
  const tSenior = pickTeacher(["10C"]);
  await grantStaffLogin("teacher-senior", tSenior.staffId, "Class teacher of 10C — senior grade view");
  const tSiblings = pickTeacher(siblingPairs.map((p) => p[0].classKey));
  await grantStaffLogin("teacher-siblings", tSiblings.staffId, `Class teacher of ${tSiblings.classKey} — has a sibling of another demo student`);

  const sSingleChild = pickGuardianStudent(
    studentList.filter((s) => siblingOwner.get(s.id) === s.id && !lowAttendanceIds.has(s.id) && !atRiskIds.has(s.id))
  );
  await grantGuardianLogin("parent-single-child", "Single child, ordinary attendance/results", sSingleChild);
  const sSiblings = pickGuardianStudent(siblingPairs.map((p) => p[0]));
  await grantGuardianLogin("parent-siblings", "Multi-child household — two children in different classes", sSiblings);
  const sLowAttendance = pickGuardianStudent(lowAttendanceStudents);
  await grantGuardianLogin("parent-low-attendance", "Child below 85% attendance — triggers console alert", sLowAttendance);
  const sPendingLeave = pickGuardianStudent(pendingLeaveStudents);
  await grantGuardianLogin("parent-pending-leave", "Child has a pending leave request awaiting decision", sPendingLeave);
  const sStayBack = pickGuardianStudent(stayBackPending);
  await grantGuardianLogin("parent-stay-back", "Child has a pending stay-back consent request", sStayBack);
  const sFailingMarks = pickGuardianStudent(Object.values(atRiskByClass));
  await grantGuardianLogin("parent-failing-marks", "Child is failing a subject — analytics at-risk case", sFailingMarks);
  const sUrgentMessage = pickGuardianStudent(studentsByClass["5A"]);
  await grantGuardianLogin("parent-urgent-message", "Has an unread urgent school message in the inbox", sUrgentMessage);
  const sOpenPtm = pickGuardianStudent(studentsByClass[openPtmDemoClass]);
  await grantGuardianLogin("parent-open-ptm", `Child's class (${openPtmDemoClass}) has an open, bookable PTM slot`, sOpenPtm);
  const sCentum = pickGuardianStudent(centumStudents);
  await grantGuardianLogin("parent-centum", "Child scored a centum (100/100) this term", sCentum);
  const sTopPerformer = pickGuardianStudent(Object.values(topPerformerByClass));
  await grantGuardianLogin("parent-top-performer", "Child is the class topper", sTopPerformer);
  const sDeclinedLeave = pickGuardianStudent(declinedLeaveStudents);
  await grantGuardianLogin("parent-declined-leave", "Child had a leave request declined", sDeclinedLeave);
  const sPrimaryGrade = pickGuardianStudent(studentsByClass["1A"]);
  await grantGuardianLogin("parent-primary-grade", "Child in Grade 1 (youngest cohort)", sPrimaryGrade);
  const sSeniorGrade = pickGuardianStudent(studentsByClass["10C"]);
  await grantGuardianLogin("parent-senior-grade", "Child in Grade 10 (oldest cohort)", sSeniorGrade);

  const urgentMessageHeroGuardianId = guardianIdsByOwner.get(siblingOwner.get(sUrgentMessage.id))[0];

  // =======================================================================
  // INSERT: people & classes
  // =======================================================================
  console.log("Inserting people & classes...");
  await batchInsert("staff", staffList.map(({ _key, ...r }) => r));
  await batchInsert("class_sections", classSectionList.map(({ _key, ...r }) => r));
  await batchInsert("students", studentList.map(({ classKey, ...r }) => r));
  await batchInsert("guardians", guardianList);
  await batchInsert("guardian_student", guardianStudentLinks);

  // =======================================================================
  // 7. ATTENDANCE
  // =======================================================================
  console.log("Building attendance...");
  const today = new Date();
  const lastSchoolDay = new Date(today);
  while (lastSchoolDay.getDay() === 0) lastSchoolDay.setDate(lastSchoolDay.getDate() - 1);
  const attendanceStart = addDays(lastSchoolDay, -42);
  const schoolDays = [];
  for (let d = new Date(attendanceStart); d <= lastSchoolDay; d = addDays(d, 1)) {
    if (d.getDay() !== 0) schoolDays.push(isoDate(d));
  }
  const lastSchoolDayIso = isoDate(lastSchoolDay);

  const attendanceRows = [];
  for (const s of studentList) {
    const isLow = lowAttendanceIds.has(s.id);
    const markedBy = classTeacherIdByClassKey[s.classKey];
    for (const day of schoolDays) {
      let status;
      if (day === lastSchoolDayIso && (s.id === absentTodayWithLeave.id || s.id === absentTodayNoLeave.id)) {
        status = "absent";
      } else {
        const r = rng.float();
        status = isLow
          ? r < 0.68 ? "present" : r < 0.9 ? "absent" : r < 0.97 ? "late" : "half_day"
          : r < 0.92 ? "present" : r < 0.96 ? "absent" : r < 0.99 ? "late" : "half_day";
      }
      attendanceRows.push({
        id: demoId("attendance", `${s.id}:${day}`),
        student_id: s.id, date: day, status, marked_by: markedBy,
      });
    }
  }
  await batchInsert("attendance_records", attendanceRows, 1000);

  // =======================================================================
  // 8. EXAM RESULTS
  // =======================================================================
  console.log("Building exam results...");
  const ALL_SUBJECTS = [...CORE_SUBJECTS, ...SPECIALIST_SUBJECTS];
  const examRows = [];
  for (const s of studentList) {
    const ability = abilityByStudent[s.id];
    for (const term of TERMS) {
      for (const subject of ALL_SUBJECTS) {
        const maxMarks = subject === "Physical Education" || subject === "Art" ? 50 : 100;
        let pct = clamp(ability * 100 + (rng.float() - 0.5) * 16, 5, 100);
        if (atRiskIds.has(s.id) && subject === failingSubjectFor[s.id]) pct = rng.int(15, 38);
        if (topPerformerIds.has(s.id)) pct = clamp(pct, 82, 100);
        if (term === "Term 2" && centumSubjectFor[s.id] === subject) pct = 100;
        const marks = Math.round((pct / 100) * maxMarks);
        examRows.push({
          id: demoId("exam", `${s.id}:${term}:${subject}`),
          student_id: s.id, term, subject, marks, max_marks: maxMarks, grade: gradeFor(pct),
        });
      }
    }
  }
  await batchInsert("exam_results", examRows, 1000);

  // =======================================================================
  // 9. DEFAULTER RECORDS
  // =======================================================================
  console.log("Building defaulter records...");
  const INCIDENTS = [
    "Late to morning assembly", "Uniform not in order", "Homework not submitted",
    "Talking during class", "Skipped PE without permission", "Left classroom without permission",
    "Mobile phone brought to class", "Untidy notebook", "Disturbing the class during a lecture",
    "Not carrying textbooks",
  ];
  const ACTIONS = [
    "Verbal warning issued", "Counselled by class teacher", "Parent informed via note",
    "Written warning issued", "Seat reassigned", "Required to complete work during break",
    "Referred to school counsellor",
  ];
  const defaulterRows = [];
  for (const s of singleDefaulters) {
    const date = schoolDays[rng.int(0, schoolDays.length - 1)];
    defaulterRows.push({
      id: demoId("defaulter", `${s.id}:1`), student_id: s.id, incident_date: date,
      description: rng.pick(INCIDENTS), action_taken: rng.pick(ACTIONS),
      recorded_by: classTeacherIdByClassKey[s.classKey],
    });
  }
  const escalation = ["Verbal warning issued", "Written warning issued; parent informed", "Parent meeting requested with principal"];
  const repeatDates = rng.sample(schoolDays, 3).sort();
  repeatDates.forEach((date, i) => {
    defaulterRows.push({
      id: demoId("defaulter", `${repeatDefaulter.id}:${i + 1}`), student_id: repeatDefaulter.id, incident_date: date,
      description: rng.pick(INCIDENTS), action_taken: escalation[i],
      recorded_by: classTeacherIdByClassKey[repeatDefaulter.classKey],
    });
  });
  await batchInsert("defaulter_records", defaulterRows);

  // =======================================================================
  // 10. LEAVE REQUESTS
  // =======================================================================
  console.log("Building leave requests...");
  const LEAVE_REASONS = [
    "Family function", "Fever and cold", "Travel out of station", "Function at home",
    "Doctor's appointment", "Cousin's wedding", "Not feeling well", "Family emergency",
    "Religious observance at home", "Relocation formalities",
  ];
  function requesterFor(student) {
    return guardianIdsByOwner.get(siblingOwner.get(student.id))[0];
  }
  const leaveRows = [];
  for (const s of pendingLeaveStudents) {
    const from = addDays(lastSchoolDay, rng.int(2, 14));
    const to = addDays(from, rng.int(0, 2));
    leaveRows.push({
      id: demoId("leave", `${s.id}:pending`), student_id: s.id, requested_by: requesterFor(s),
      from_date: isoDate(from), to_date: isoDate(to), reason: rng.pick(LEAVE_REASONS), status: "pending",
    });
  }
  for (const s of approvedLeaveStudents) {
    const from = addDays(lastSchoolDay, -rng.int(3, 35));
    const to = addDays(from, rng.int(0, 3));
    leaveRows.push({
      id: demoId("leave", `${s.id}:approved`), student_id: s.id, requested_by: requesterFor(s),
      from_date: isoDate(from), to_date: isoDate(to), reason: rng.pick(LEAVE_REASONS), status: "approved",
      decided_by: classTeacherIdByClassKey[s.classKey], decided_at: addDays(from, -1).toISOString(),
    });
  }
  for (const s of declinedLeaveStudents) {
    const from = addDays(lastSchoolDay, -rng.int(3, 35));
    leaveRows.push({
      id: demoId("leave", `${s.id}:declined`), student_id: s.id, requested_by: requesterFor(s),
      from_date: isoDate(from), to_date: isoDate(from), reason: rng.pick(LEAVE_REASONS), status: "declined",
      decided_by: classTeacherIdByClassKey[s.classKey], decided_at: addDays(from, -1).toISOString(),
    });
  }
  // Edge case: absent-today WITH an approved leave covering today (must be
  // excluded from the console "absent today" alert).
  leaveRows.push({
    id: demoId("leave", `${absentTodayWithLeave.id}:today`), student_id: absentTodayWithLeave.id,
    requested_by: requesterFor(absentTodayWithLeave), from_date: lastSchoolDayIso, to_date: lastSchoolDayIso,
    reason: "Not feeling well", status: "approved",
    decided_by: classTeacherIdByClassKey[absentTodayWithLeave.classKey], decided_at: addDays(lastSchoolDay, -1).toISOString(),
  });
  await batchInsert("leave_requests", leaveRows);

  // =======================================================================
  // 11. STAY-BACK CONSENTS
  // =======================================================================
  console.log("Building stay-back consents...");
  const STAY_BACK_REASONS = ["Extra coaching class", "Sports practice", "Music rehearsal", "Project work with group", "Remedial class", "School club meeting"];
  const stayBackRows = [];
  function stayBackBase(s, key) {
    const date = addDays(lastSchoolDay, rng.int(1, 10));
    return {
      id: demoId("staybak", `${s.id}:${key}`), student_id: s.id,
      raised_by_guardian_id: requesterFor(s), teacher_id: classTeacherIdByClassKey[s.classKey],
      reason: rng.pick(STAY_BACK_REASONS), stay_date: isoDate(date), from_time: "15:15:00", to_time: "16:15:00",
    };
  }
  for (const s of stayBackPending) stayBackRows.push({ ...stayBackBase(s, "pending"), status: "pending" });
  for (const s of stayBackTeacherPendingPrincipal) {
    stayBackRows.push({
      ...stayBackBase(s, "teacher-yes-principal-pending"), status: "pending",
      teacher_decision: "approved", teacher_decided_at: addDays(lastSchoolDay, -1).toISOString(),
    });
  }
  for (const s of stayBackTeacherDeclined) {
    stayBackRows.push({
      ...stayBackBase(s, "teacher-declined"), status: "declined",
      teacher_decision: "declined", teacher_decided_at: addDays(lastSchoolDay, -1).toISOString(),
    });
  }
  for (const s of stayBackBothApproved) {
    stayBackRows.push({
      ...stayBackBase(s, "both-approved"), status: "approved",
      teacher_decision: "approved", teacher_decided_at: addDays(lastSchoolDay, -2).toISOString(),
      principal_decision: "approved", principal_decided_at: addDays(lastSchoolDay, -1).toISOString(),
    });
  }
  for (const s of stayBackPrincipalDeclined) {
    stayBackRows.push({
      ...stayBackBase(s, "principal-declined"), status: "declined",
      teacher_decision: "approved", teacher_decided_at: addDays(lastSchoolDay, -2).toISOString(),
      principal_decision: "declined", principal_decided_at: addDays(lastSchoolDay, -1).toISOString(),
    });
  }
  await batchInsert("stay_back_consents", stayBackRows);

  // =======================================================================
  // 12. DTR EVENTS
  // =======================================================================
  console.log("Building DTR events...");
  const dtrRows = [
    { title: "Independence Day", category: "holiday", offset: -20, classKeys: [] },
    { title: "Term 2 Unit Test 1 begins", category: "exam", offset: 5, classKeys: [] },
    { title: "Annual Sports Day", category: "event", offset: 25, classKeys: [] },
    { title: "Fee Payment Deadline — Term 2", category: "deadline", offset: 10, classKeys: [] },
    { title: "Gandhi Jayanti", category: "holiday", offset: 40, classKeys: [] },
    { title: "PTA General Body Meeting", category: "ptm", offset: 14, classKeys: [] },
    { title: "Diwali Vacation Begins", category: "holiday", offset: 55, classKeys: [] },
    { title: "Science Exhibition — Grade 8", category: "event", offset: 18, classKeys: ["8A", "8B", "8C"] },
    { title: "Investiture Ceremony", category: "event", offset: 12, classKeys: [] },
    { title: "Republic Day Rehearsal", category: "event", offset: -8, classKeys: [] },
    { title: "Grade 10 Board Exam Prep Deadline", category: "deadline", offset: 30, classKeys: ["10A", "10B", "10C"] },
    { title: "Annual Day Rehearsals Begin", category: "event", offset: 22, classKeys: [] },
    { title: "Unit Test 2 Syllabus Released", category: "deadline", offset: 3, classKeys: [] },
    { title: "Career Counselling Session — Grade 9/10", category: "event", offset: 16, classKeys: ["9A", "9B", "9C", "10A", "10B", "10C"] },
    { title: "Founders' Day", category: "event", offset: 33, classKeys: [] },
    { title: "Winter Break Begins", category: "holiday", offset: 60, classKeys: [] },
    { title: "Parent Orientation — Grade 1", category: "ptm", offset: -5, classKeys: ["1A", "1B", "1C"] },
    { title: "Book Fair", category: "event", offset: 9, classKeys: [] },
    { title: "Mid-Term Feedback Deadline", category: "deadline", offset: -2, classKeys: [] },
    { title: "Republic Day", category: "holiday", offset: -30, classKeys: [] },
  ];
  const dtrEventRows = [];
  const dtrEventClassRows = [];
  for (const ev of dtrRows) {
    const id = demoId("dtr", ev.title);
    dtrEventRows.push({
      id, title: ev.title, event_date: isoDate(addDays(lastSchoolDay, ev.offset)),
      category: ev.category, description: null, created_by: principalId,
    });
    for (const ck of ev.classKeys) dtrEventClassRows.push({ dtr_event_id: id, class_section_id: classIdByKey[ck] });
  }
  await batchInsert("dtr_events", dtrEventRows);
  await batchInsert("dtr_event_classes", dtrEventClassRows);

  // =======================================================================
  // 13. CUSTOM GROUPS
  // =======================================================================
  console.log("Building custom groups...");
  const groupDefs = [
    { name: "Inter-School Sports Team", count: 12, scope: "all" },
    { name: "Debate Club", count: 15, scope: "all" },
    { name: "Grade 10 Science Fair Team", count: 5, scope: "10" },
    { name: "Bus Route 4 — Students", count: 20, scope: "all" },
    { name: "Annual Day Choir", count: 25, scope: "all" },
    { name: "State Chess Championship — Solo Entry", count: 1, scope: "all" },
  ];
  const groupRows = [];
  const groupMemberRows = [];
  for (const def of groupDefs) {
    const id = demoId("group", def.name);
    groupRows.push({ id, name: def.name, created_by: principalId });
    const pool = def.scope === "all" ? studentList : studentList.filter((s) => s.classKey.startsWith(def.scope));
    const members = rng.sample(pool, Math.min(def.count, pool.length));
    for (const m of members) groupMemberRows.push({ custom_group_id: id, student_id: m.id });
  }
  await batchInsert("custom_groups", groupRows);
  await batchInsert("custom_group_students", groupMemberRows);
  const debateClubId = groupRows[1].id;
  const sportsTeamId = groupRows[0].id;

  // =======================================================================
  // 14. MESSAGES
  // =======================================================================
  console.log("Building messages...");
  const messageDefs = [
    { subject: "Term 2 exam schedule released", body: "The Term 2 examination schedule is now available on the notice board and will be shared via a circular shortly.", scope: "school", urgent: false, daysAgo: 10 },
    { subject: "Annual Sports Day — save the date", body: "Annual Sports Day will be held next month. Details on events and participation to follow.", scope: "school", urgent: false, daysAgo: 6 },
    { subject: "Diwali vacation dates confirmed", body: "The school will remain closed for Diwali vacation. Classes resume as per the academic calendar.", scope: "school", urgent: false, daysAgo: 3 },
    { subject: "URGENT: School closed tomorrow due to heavy rain", body: "Owing to the heavy rainfall warning issued by the district administration, the school will remain closed tomorrow. Stay safe.", scope: "school", urgent: true, daysAgo: 1 },
    { subject: "PTA general meeting this Saturday", body: "All parents are requested to attend the PTA general body meeting this Saturday at 10 AM in the school auditorium.", scope: "school", urgent: false, daysAgo: 14, attachment: { file_name: "PTA_Meeting_Agenda.pdf", size: 182_400 } },
    { subject: "Field trip permission slip due Friday", body: "Please sign and return the field trip permission slip by Friday. Kindly ensure your child carries a water bottle and packed lunch.", scope: "class", classKeys: ["6A", "6B"], urgent: false, daysAgo: 8, attachment: { file_name: "Field_Trip_Permission_Form.pdf", size: 154_900 } },
    { subject: "Unit test syllabus for Grade 5", body: "The syllabus for the upcoming unit test has been finalised. Please review with your child.", scope: "class", classKeys: ["5A"], urgent: false, daysAgo: 5 },
    { subject: "Reminder: bring sports uniform tomorrow", body: "All students are requested to come in sports uniform tomorrow for the PE assessment.", scope: "class", classKeys: ["8A", "8B", "8C"], urgent: false, daysAgo: 2 },
    { subject: "Grade 10 board exam prep — extra classes", body: "Extra preparatory classes for board exams will be held on weekends starting next week.", scope: "class", classKeys: ["10A", "10B", "10C"], urgent: true, daysAgo: 4 },
    { subject: "Congratulations on the excellent Term 1 result", body: "Your child has performed exceptionally well this term. Keep up the good work!", scope: "student", studentPick: () => topPerformerByClass[classKeys[2]], urgent: false, daysAgo: 20 },
    { subject: "Fee overdue reminder", body: "This is a reminder that a fee installment for your ward is overdue. Kindly clear the dues at the earliest.", scope: "student", studentPick: () => atRiskByClass[classKeys[3]], urgent: true, daysAgo: 7 },
    { subject: "Counselling session scheduled", body: "A short counselling session has been scheduled for your child with the school counsellor next week.", scope: "student", studentPick: () => repeatDefaulter, urgent: false, daysAgo: 3 },
    { subject: "Attendance concern — please contact class teacher", body: "We've noticed your child's attendance has dropped below the required threshold. Please get in touch with the class teacher.", scope: "student", studentPick: () => lowAttendanceStudents[0], urgent: true, daysAgo: 2 },
    { subject: "Sports team practice rescheduled", body: "Practice for the inter-school sports team has been moved to 4 PM this week due to ground maintenance.", scope: "group", groupId: () => sportsTeamId, urgent: false, daysAgo: 4 },
    { subject: "Debate club — bring your research notes", body: "Please bring your prepared research notes for tomorrow's debate club session.", scope: "group", groupId: () => debateClubId, urgent: false, daysAgo: 9 },
    { subject: "Term 3 fee structure — to be sent soon", body: "The Term 3 fee structure is being finalised and will be circulated by end of week.", scope: "school", urgent: false, scheduled: true },
  ];

  const messageRows = [];
  const messageTargetRows = [];
  const messageAttachmentRows = [];
  const messageReceiptRows = [];

  for (const def of messageDefs) {
    const id = demoId("msg", def.subject);
    const sentAt = def.scheduled ? null : addDays(lastSchoolDay, -def.daysAgo).toISOString();
    const scheduledFor = def.scheduled ? addDays(lastSchoolDay, 5).toISOString() : null;
    messageRows.push({
      id, subject: def.subject, body: def.body, sender_id: principalId,
      scope_type: def.scope, urgent: def.urgent, sent_at: sentAt, scheduled_for: scheduledFor,
    });

    let targetStudentIds = [];
    if (def.scope === "school") {
      targetStudentIds = studentList.map((s) => s.id);
    } else if (def.scope === "class") {
      for (const ck of def.classKeys) messageTargetRows.push({ message_id: id, class_section_id: classIdByKey[ck] });
      targetStudentIds = def.classKeys.flatMap((ck) => studentsByClass[ck].map((s) => s.id));
    } else if (def.scope === "student") {
      const student = def.studentPick();
      messageTargetRows.push({ message_id: id, student_id: student.id });
      targetStudentIds = [student.id];
    } else if (def.scope === "group") {
      const gid = def.groupId();
      messageTargetRows.push({ message_id: id, custom_group_id: gid });
      targetStudentIds = groupMemberRows.filter((r) => r.custom_group_id === gid).map((r) => r.student_id);
    }

    if (def.attachment) {
      messageAttachmentRows.push({
        id: demoId("attach", def.subject),
        message_id: id, file_name: def.attachment.file_name,
        storage_url: `https://firebasestorage.googleapis.com/v0/b/manthan-parent-portal.appspot.com/o/demo%2F${encodeURIComponent(def.attachment.file_name)}?alt=media`,
        size_bytes: def.attachment.size,
      });
    }

    if (sentAt) {
      const guardianIds = [...new Set(targetStudentIds.map((sid) => guardianIdsByOwner.get(siblingOwner.get(sid))).flat())];
      for (const gid of guardianIds) {
        const delivered = addDays(new Date(sentAt), 0).toISOString();
        const isRead = rng.chance(0.6);
        messageReceiptRows.push({
          message_id: id, guardian_id: gid, delivered_at: delivered,
          read_at: isRead ? addDays(new Date(sentAt), rng.int(0, 2)).toISOString() : null,
        });
      }
    }
  }
  // Edge case: guardian with a definitely-unread urgent message.
  const urgentMsgId = messageRows.find((m) => m.subject.startsWith("URGENT:")).id;
  const heroReceiptIdx = messageReceiptRows.findIndex(
    (r) => r.message_id === urgentMsgId && r.guardian_id === urgentMessageHeroGuardianId
  );
  if (heroReceiptIdx >= 0) messageReceiptRows[heroReceiptIdx].read_at = null;

  await batchInsert("messages", messageRows);
  await batchInsert("message_targets", messageTargetRows);
  await batchInsert("message_attachments", messageAttachmentRows);
  await batchInsert("message_receipts", messageReceiptRows, 1000);

  // =======================================================================
  // 15. PTM MEETINGS & SLOTS
  // =======================================================================
  console.log("Building PTM meetings & slots...");
  const ptmClassKeys = new Set(rng.sample(classKeys, 20));
  ptmClassKeys.add(openPtmDemoClass);
  const ptmMeetingRows = [];
  const ptmSlotRows = [];
  for (const ck of ptmClassKeys) {
    const meetingDate = addDays(lastSchoolDay, rng.int(-10, 14));
    const status = ck === openPtmDemoClass ? "open" : rng.chance(0.2) ? "closed" : "open";
    const meetingId = demoId("ptmmeet", ck);
    ptmMeetingRows.push({
      id: meetingId, class_section_id: classIdByKey[ck], teacher_id: classTeacherIdByClassKey[ck],
      title: "Parent-Teacher Meeting — Term 2", meeting_date: isoDate(meetingDate), status,
    });
    const roster = studentsByClass[ck];
    const slotCount = 8;
    for (let i = 0; i < slotCount; i += 1) {
      const startMinutes = 9 * 60 + i * 15;
      const startsAt = `${isoDate(meetingDate)} ${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}:00+05:30`;
      const endMinutes = startMinutes + 15;
      const endsAt = `${isoDate(meetingDate)} ${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00+05:30`;
      const forceOpen = ck === openPtmDemoClass && i < 3;
      const booked = !forceOpen && rng.chance(0.6) && i < roster.length;
      const student = booked ? roster[i] : null;
      ptmSlotRows.push({
        id: demoId("ptmslot", `${ck}:${i}`), teacher_id: classTeacherIdByClassKey[ck],
        class_section_id: classIdByKey[ck], starts_at: startsAt, ends_at: endsAt,
        booked_by_guardian_id: student ? guardianIdsByOwner.get(siblingOwner.get(student.id))[0] : null,
        booked_student_id: student ? student.id : null, meeting_id: meetingId,
      });
    }
  }
  await batchInsert("ptm_meetings", ptmMeetingRows);
  await batchInsert("ptm_slots", ptmSlotRows);

  // =======================================================================
  // 16. TIMETABLE
  // =======================================================================
  console.log("Building timetable...");
  const teacherOccupancy = new Set(); // `${teacherId}|${day}|${periodId}`
  const timetableRows = [];
  const timetableRowIndexByClassDayPeriod = {};

  for (const cs of classSectionList) {
    const ck = cs._key;
    const multiset = [];
    for (const subject of [...CORE_SUBJECTS, ...SPECIALIST_SUBJECTS]) {
      for (let i = 0; i < WEEKLY_TARGET[subject]; i += 1) multiset.push(subject);
    }
    const shuffled = rng.shuffle(multiset); // length 54
    for (let day = 1; day <= 6; day += 1) {
      const daySubjects = shuffled.slice((day - 1) * 9, day * 9);
      const periodsForDay = rng.shuffle(nonBreakPeriods);
      daySubjects.forEach((subject, idx) => {
        const period = periodsForDay[idx];
        let teacherId;
        if (CORE_SUBJECTS.includes(subject)) {
          teacherId = classTeacherIdByClassKey[ck];
        } else {
          const pool = rng.shuffle(specialistIdsBySubject[subject]);
          teacherId = pool.find((tid) => !teacherOccupancy.has(`${tid}|${day}|${period.id}`)) ?? null;
          if (teacherId) teacherOccupancy.add(`${teacherId}|${day}|${period.id}`);
        }
        const rowId = demoId("tt", `${ck}:${day}:${period.id}`);
        const row = {
          id: rowId, class_section_id: cs.id, day_of_week: day, period_id: period.id,
          subject_id: subjectIdByName[subject], teacher_id: teacherId,
        };
        timetableRows.push(row);
        timetableRowIndexByClassDayPeriod[`${ck}:${day}:${period.id}`] = timetableRows.length - 1;
      });
    }
  }

  // Deliberate collision: copy one of class A's real specialist-teacher
  // assignments onto class B at the same day+period. Copying an assignment
  // that's already exclusively class A's (the occupancy map guarantees no
  // other class shares it) guarantees an exact 2-way collision — inventing
  // an arbitrary (teacher, day, period) triple instead risked a class that
  // already, legitimately, held that same slot, producing a 3-way collision.
  const classATeacherEntries = timetableRows.filter(
    (r) =>
      r.class_section_id === classIdByKey[collisionClassA] &&
      r.teacher_id &&
      r.teacher_id !== classTeacherIdByClassKey[collisionClassA]
  );
  const sourceEntry = rng.pick(classATeacherEntries);
  const targetKey = `${collisionClassB}:${sourceEntry.day_of_week}:${sourceEntry.period_id}`;
  const targetIdx = timetableRowIndexByClassDayPeriod[targetKey];
  timetableRows[targetIdx].subject_id = sourceEntry.subject_id;
  timetableRows[targetIdx].teacher_id = sourceEntry.teacher_id;
  const collisionPeriodLabel = nonBreakPeriods.find((p) => p.id === sourceEntry.period_id)?.label;
  console.log(
    `Planted timetable collision: teacher ${sourceEntry.teacher_id} double-booked in ${collisionClassA} and ` +
      `${collisionClassB} on day ${sourceEntry.day_of_week}, period "${collisionPeriodLabel}".`
  );

  await batchInsert("timetable_entries", timetableRows, 1000);

  // =======================================================================
  // 17. QR CODES
  // =======================================================================
  console.log("Building QR codes...");
  const qrRows = studentList.map((s) => ({
    student_id: s.id, token: randomUUID(), issued_by: principalId,
  }));
  await batchInsert("student_qr_codes", qrRows, 1000);

  // =======================================================================
  // 18. INVOICES & PAYMENTS
  // =======================================================================
  console.log("Building invoices & payments...");
  const gradeBandFee = (grade) => (Number(grade) <= 5 ? 28000 : Number(grade) <= 8 ? 34000 : 42000);
  const invoiceRows = [];
  const paymentRows = [];
  for (const s of studentList) {
    const cs = classSectionList.find((c) => c._key === s.classKey);
    const tuition = gradeBandFee(cs.grade) * 100; // paise
    const t1Id = demoId("invoice", `${s.id}:t1`);
    const t1Status = rng.chance(0.85) ? "paid" : "overdue";
    invoiceRows.push({
      id: t1Id, student_id: s.id, fee_head: "Term 1 Tuition", amount_paise: tuition,
      due_date: isoDate(addDays(lastSchoolDay, -70)), status: t1Status,
    });
    if (t1Status === "paid") {
      paymentRows.push({
        id: demoId("payment", `${t1Id}`), invoice_id: t1Id, amount_paise: tuition,
        gateway_reference: `PAY-${demoId("payment", t1Id).slice(9, 17).toUpperCase()}`,
        paid_at: addDays(lastSchoolDay, -65).toISOString(),
      });
    }
    const t2Id = demoId("invoice", `${s.id}:t2`);
    const r = rng.float();
    const t2Status = r < 0.4 ? "due" : r < 0.65 ? "partially_paid" : r < 0.9 ? "paid" : "overdue";
    invoiceRows.push({
      id: t2Id, student_id: s.id, fee_head: "Term 2 Tuition", amount_paise: tuition,
      due_date: isoDate(addDays(lastSchoolDay, 10)), status: t2Status,
    });
    if (t2Status === "paid") {
      paymentRows.push({
        id: demoId("payment", `${t2Id}`), invoice_id: t2Id, amount_paise: tuition,
        gateway_reference: `PAY-${demoId("payment", t2Id).slice(9, 17).toUpperCase()}`,
        paid_at: addDays(lastSchoolDay, -2).toISOString(),
      });
    } else if (t2Status === "partially_paid") {
      const partial = Math.round(tuition * 0.5);
      paymentRows.push({
        id: demoId("payment", `${t2Id}:partial`), invoice_id: t2Id, amount_paise: partial,
        gateway_reference: `PAY-${demoId("payment", `${t2Id}:partial`).slice(9, 17).toUpperCase()}`,
        paid_at: addDays(lastSchoolDay, -3).toISOString(),
      });
    }
  }
  await batchInsert("invoices", invoiceRows, 1000);
  await batchInsert("payments", paymentRows, 1000);

  // =======================================================================
  // CREDENTIALS FILE
  // =======================================================================
  const credPath = join(__dirname, "CREDENTIALS.md");
  const credBody = [
    "# Manthan Parent Portal — demo login credentials",
    "",
    `Generated ${new Date().toISOString()}. All accounts share the password \`${DEMO_PASSWORD}\`.`,
    "Delete all demo data (including these auth accounts) with `npm run demo:teardown`.",
    "",
    "| Type | Name | Email | Password | Scenario |",
    "|---|---|---|---|---|",
    ...credentialLines,
    "",
  ].join("\n");
  writeFileSync(credPath, credBody, "utf8");

  console.log("\n== Done ==");
  console.log(`Demo id prefix: ${DEMO_PREFIX}-...`);
  console.log(`Classes: ${classSectionList.length}, Students: ${studentList.length}, Guardians: ${guardianList.length}, Staff: ${staffList.length}`);
  console.log(`Credentials written to ${credPath}`);
  console.log(credBody);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
