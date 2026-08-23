// One-off, idempotent script for local testing: links a second existing
// student to the manually-created test@parent.com guardian account (for
// multi-child parent UI testing), and trims the demo dataset's dummy PTM
// meetings down to a handful so "Delete PTM" isn't blocked everywhere.
//
// Run with: npm run demo:add-test-account   (uses node --env-file=.env.local)
import { supabase } from "./lib/supabase.mjs";

const TEST_EMAIL = "test@parent.com";
const KEEP_MEETINGS = 4;

async function main() {
  console.log(`Looking up guardian for ${TEST_EMAIL}...`);
  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .select("id, name")
    .eq("email", TEST_EMAIL)
    .maybeSingle();
  if (guardianError) throw new Error(guardianError.message);
  if (!guardian) {
    throw new Error(
      `No guardian row found with email ${TEST_EMAIL}. This script only links a second ` +
        "child to an already-existing account — create the account first."
    );
  }

  const { data: existingLinks, error: linksError } = await supabase
    .from("guardian_student")
    .select("student_id, students(class_section_id)")
    .eq("guardian_id", guardian.id);
  if (linksError) throw new Error(linksError.message);

  const linkedStudentIds = new Set((existingLinks ?? []).map((l) => l.student_id));
  const linkedClassIds = new Set(
    (existingLinks ?? []).map((l) => l.students?.class_section_id).filter(Boolean)
  );
  console.log(`${guardian.name} (${guardian.id}) currently has ${linkedStudentIds.size} child(ren) linked.`);

  if (linkedStudentIds.size >= 2) {
    console.log("Already has 2+ children linked — nothing to do.");
  } else {
    // Prefer a student in a different class from the existing child(ren), so
    // the class/global switcher actually has something distinct to show.
    const { data: candidates, error: candidatesError } = await supabase
      .from("students")
      .select("id, first_name, last_name, class_section_id")
      .order("first_name")
      .limit(500);
    if (candidatesError) throw new Error(candidatesError.message);

    const pick =
      (candidates ?? []).find(
        (s) => !linkedStudentIds.has(s.id) && !linkedClassIds.has(s.class_section_id)
      ) ?? (candidates ?? []).find((s) => !linkedStudentIds.has(s.id));

    if (!pick) throw new Error("No unlinked student available to add as a second child.");

    const { error: insertError } = await supabase
      .from("guardian_student")
      .insert({ guardian_id: guardian.id, student_id: pick.id });
    if (insertError) throw new Error(insertError.message);
    console.log(`Linked ${pick.first_name} ${pick.last_name} (${pick.id}) as a second child.`);
  }

  // Trim dummy PTM meetings — keep a few, delete the rest of the seeded
  // (5eed0000-...) demo meetings so "Delete PTM" isn't blocked on nearly
  // every meeting by pre-booked dummy data.
  console.log("\nTrimming dummy PTM meetings...");
  const { data: meetings, error: meetingsError } = await supabase
    .from("ptm_meetings")
    .select("id")
    .gte("id", "5eed0000-0000-0000-0000-000000000000")
    .lt("id", "5eed0001-0000-0000-0000-000000000000")
    .order("meeting_date", { ascending: false });
  if (meetingsError) throw new Error(meetingsError.message);

  const toDelete = (meetings ?? []).slice(KEEP_MEETINGS).map((m) => m.id);
  if (toDelete.length === 0) {
    console.log(`Only ${meetings?.length ?? 0} dummy meetings exist — nothing to trim.`);
  } else {
    const { error: stepsError } = await supabase
      .from("approval_steps")
      .delete()
      .eq("subject_type", "ptm_slot_request")
      .in(
        "subject_id",
        (
          await supabase.from("ptm_slots").select("id").in("meeting_id", toDelete)
        ).data?.map((s) => s.id) ?? []
      );
    if (stepsError) throw new Error(stepsError.message);

    const { error: slotsError } = await supabase.from("ptm_slots").delete().in("meeting_id", toDelete);
    if (slotsError) throw new Error(slotsError.message);

    const { error: deleteError, count } = await supabase
      .from("ptm_meetings")
      .delete({ count: "exact" })
      .in("id", toDelete);
    if (deleteError) throw new Error(deleteError.message);
    console.log(`Deleted ${count ?? toDelete.length} dummy PTM meetings, kept ${KEEP_MEETINGS}.`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
