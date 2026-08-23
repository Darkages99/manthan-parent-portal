"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { createApprovalChain } from "@/lib/approvals";

export async function bookSlot(slotId: string, studentId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");
  if (!viewer.students.some((s) => s.id === studentId)) throw new Error("Not your child");

  const supabase = await createClient();
  const { data: slot, error: slotError } = await supabase
    .from("ptm_slots")
    .select("id, teacher_id")
    .eq("id", slotId)
    .single();
  if (slotError || !slot) throw new Error("Slot not found");

  // Only claim the slot if it's still fully unclaimed — guards against a
  // double-book race. This puts the guardian on a provisional hold; the
  // booking only becomes final once every step below approves it (see
  // decidePtmBooking in the staff console).
  const { data, error } = await supabase
    .from("ptm_slots")
    .update({ pending_guardian_id: viewer.guardian.id, booked_student_id: studentId })
    .eq("id", slotId)
    .is("booked_by_guardian_id", null)
    .is("pending_guardian_id", null)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("That slot was just taken — pick another.");

  // approval_steps only grants guardians SELECT via RLS (staff manage the
  // rows); use the admin client to seed the review chain this booking kicks
  // off. Clear out any stale chain left over from a previously declined
  // cycle on this same slot first, so status computation starts clean.
  const admin = createAdminClient();
  await admin
    .from("approval_steps")
    .delete()
    .eq("subject_type", "ptm_slot_request")
    .eq("subject_id", slotId);
  // 2-step chain: admin (principal, or a coordinator acting as admin — see
  // resolveApproverRole) and the named teacher. Everyone else just gets
  // notified, not asked to approve.
  await createApprovalChain(admin, "ptm_slot_request", slotId, [
    { approverRole: "principal" },
    { approverRole: "class_teacher", approverStaffId: slot.teacher_id },
  ]);

  revalidatePath("/ptm");
}

export async function cancelSlot(slotId: string) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "guardian") throw new Error("Not signed in as a guardian");

  const supabase = await createClient();
  const { data: slot } = await supabase
    .from("ptm_slots")
    .select("booked_by_guardian_id, pending_guardian_id")
    .eq("id", slotId)
    .single();
  if (!slot) throw new Error("Slot not found");
  if (
    slot.booked_by_guardian_id !== viewer.guardian.id &&
    slot.pending_guardian_id !== viewer.guardian.id
  ) {
    throw new Error("That isn't your booking");
  }

  const { data, error } = await supabase
    .from("ptm_slots")
    .update({ booked_by_guardian_id: null, pending_guardian_id: null, booked_student_id: null })
    .eq("id", slotId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Couldn't cancel — the meeting may be closed.");

  // Clear the approval chain so this slot starts clean if it's booked again.
  const admin = createAdminClient();
  await admin
    .from("approval_steps")
    .delete()
    .eq("subject_type", "ptm_slot_request")
    .eq("subject_id", slotId);

  revalidatePath("/ptm");
}
