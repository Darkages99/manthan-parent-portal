// Removes every row created by seed.mjs — matched purely by the 5eed0000-
// uuid prefix (or, for join tables without their own id, by a foreign key
// into a table matched that way). Deletes in FK-safe child-before-parent
// order. Never touches the pre-existing placeholder seed (a0/b0/c0/d0...).
//
// Run with `npm run demo:teardown` (uses `node --env-file=.env.local`).

import { supabase, batchDeleteByPrefix } from "./lib/supabase.mjs";

const DEMO_EMAIL_DOMAIN = "manthan-demo.test";

async function deleteDemoAuthUsers() {
  console.log("Removing demo auth.users (login-testing accounts)...");
  let page = 1;
  let removed = 0;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const demoUsers = data.users.filter((u) => u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
    for (const u of demoUsers) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) throw new Error(`deleteUser(${u.email}) failed: ${delErr.message}`);
      removed += 1;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  console.log(`  - ${removed} auth users removed`);
}

async function main() {
  console.log("== Manthan demo teardown ==");

  await deleteDemoAuthUsers();

  console.log("Deleting demo rows (child tables first)...");
  await batchDeleteByPrefix("payments");
  await batchDeleteByPrefix("invoices");
  await batchDeleteByPrefix("student_qr_codes", "student_id");
  await batchDeleteByPrefix("timetable_entries");
  await batchDeleteByPrefix("ptm_slots");
  await batchDeleteByPrefix("ptm_meetings");
  await batchDeleteByPrefix("message_receipts", "message_id");
  await batchDeleteByPrefix("message_attachments");
  await batchDeleteByPrefix("message_targets", "message_id");
  await batchDeleteByPrefix("messages");
  await batchDeleteByPrefix("custom_group_students", "custom_group_id");
  await batchDeleteByPrefix("custom_groups");
  await batchDeleteByPrefix("dtr_event_classes", "dtr_event_id");
  await batchDeleteByPrefix("dtr_events");
  await batchDeleteByPrefix("stay_back_consents");
  await batchDeleteByPrefix("leave_requests");
  await batchDeleteByPrefix("defaulter_records");
  await batchDeleteByPrefix("exam_results");
  await batchDeleteByPrefix("attendance_records");
  await batchDeleteByPrefix("guardian_student", "guardian_id");
  await batchDeleteByPrefix("guardians");
  await batchDeleteByPrefix("students");
  await batchDeleteByPrefix("class_sections");
  await batchDeleteByPrefix("staff");

  console.log("\n== Teardown complete ==");
}

main().catch((err) => {
  console.error("Teardown failed:", err);
  process.exit(1);
});
