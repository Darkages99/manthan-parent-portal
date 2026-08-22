"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { sendPush } from "@/lib/notifications/push";
import { getSmsRelay } from "@/lib/notifications/sms";
import type { Enums } from "@/lib/supabase/database.types";

type Recipient = { id: string; phone: string };

/** Admin-configurable gate on which staff role may send to which scope. Absence
 * of a row (shouldn't happen post-seed, but treat defensively) denies. */
async function requireSendPermission(
  role: Enums<"role">,
  scopeType: Enums<"message_scope_type">
): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_send_permissions")
    .select("allowed")
    .eq("role", role)
    .eq("scope_type", scopeType)
    .maybeSingle();
  if (!data?.allowed) {
    throw new Error(`Your role isn't permitted to send ${scopeType}-scoped messages.`);
  }
}

/** Resolves the guardians a message reaches, from its scope. Uses the service-
 * role client because a broadcast legitimately spans every guardian. */
async function resolveRecipients(
  scopeType: Enums<"message_scope_type">,
  classSectionIds: string[],
  studentIds: string[],
  groupIds: string[]
): Promise<Recipient[]> {
  const admin = createAdminClient();

  // Step 1: the set of students the message targets.
  let targetStudentIds: string[] = [];
  if (scopeType === "school") {
    const { data } = await admin.from("students").select("id");
    targetStudentIds = (data ?? []).map((s) => s.id);
  } else if (scopeType === "class") {
    const { data } = await admin.from("students").select("id").in("class_section_id", classSectionIds);
    targetStudentIds = (data ?? []).map((s) => s.id);
  } else if (scopeType === "student") {
    targetStudentIds = studentIds;
  } else if (scopeType === "group") {
    const { data } = await admin
      .from("custom_group_students")
      .select("student_id")
      .in("custom_group_id", groupIds);
    targetStudentIds = [...new Set((data ?? []).map((r) => r.student_id))];
  }
  if (targetStudentIds.length === 0) return [];

  // Step 2: guardians linked to those students.
  const { data: links } = await admin
    .from("guardian_student")
    .select("guardian_id")
    .in("student_id", targetStudentIds);
  const guardianIds = [...new Set((links ?? []).map((l) => l.guardian_id))];
  if (guardianIds.length === 0) return [];

  // Step 3: their phone numbers (for the urgent SMS fallback).
  const { data: guardians } = await admin
    .from("guardians")
    .select("id, phone")
    .in("id", guardianIds);
  return (guardians ?? []).map((g) => ({ id: g.id, phone: g.phone }));
}

/** Best-effort delivery side effects: read receipts, push, and (if urgent) SMS.
 * Runs after the message is committed, so a notification hiccup never fails the
 * send — it's logged instead. */
async function fanOut(
  messageId: string,
  subject: string,
  body: string,
  urgent: boolean,
  recipients: Recipient[]
) {
  if (recipients.length === 0) return;
  const admin = createAdminClient();

  // Delivery tracking — one receipt per recipient guardian.
  await admin
    .from("message_receipts")
    .upsert(
      recipients.map((r) => ({ message_id: messageId, guardian_id: r.id, delivered_at: new Date().toISOString() })),
      { onConflict: "message_id,guardian_id", ignoreDuplicates: true }
    );

  await sendPush(
    recipients.map((r) => ({ userId: r.id, role: "guardian" as const })),
    { title: subject, body, url: "/messages" },
    "messages"
  );

  if (urgent) {
    const relay = getSmsRelay();
    const text = `Manthan Vidyashram: ${subject}${body ? ` — ${body}` : ""}`.slice(0, 320);
    await Promise.all(recipients.map((r) => relay.send(r.phone, text)));
  }
}

export async function sendMessage(input: {
  subject: string;
  body: string;
  urgent: boolean;
  scopeType: Enums<"message_scope_type">;
  classSectionIds: string[];
  studentIds: string[];
  groupIds: string[];
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  await requireSendPermission(viewer.staff.role, input.scopeType);
  if (!input.subject || !input.body) throw new Error("Subject and message are required");
  if (input.scopeType === "class" && input.classSectionIds.length === 0)
    throw new Error("Pick at least one class");
  if (input.scopeType === "student" && input.studentIds.length === 0)
    throw new Error("Pick at least one student");
  if (input.scopeType === "group" && input.groupIds.length === 0)
    throw new Error("Pick at least one group");

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      subject: input.subject,
      body: input.body,
      sender_id: viewer.staff.id,
      scope_type: input.scopeType,
      urgent: input.urgent,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  let targets: {
    message_id: string;
    class_section_id?: string;
    student_id?: string;
    custom_group_id?: string;
  }[] = [];
  if (input.scopeType === "class")
    targets = input.classSectionIds.map((id) => ({ message_id: message.id, class_section_id: id }));
  else if (input.scopeType === "student")
    targets = input.studentIds.map((id) => ({ message_id: message.id, student_id: id }));
  else if (input.scopeType === "group")
    targets = input.groupIds.map((id) => ({ message_id: message.id, custom_group_id: id }));

  if (targets.length > 0) {
    const { error: targetError } = await supabase.from("message_targets").insert(targets);
    if (targetError) throw new Error(targetError.message);
  }

  // Fan out delivery: read receipts + Web Push always, SMS when urgent. Kept
  // best-effort so a notification failure doesn't roll back a sent message.
  // (Attachments, if any, are uploaded separately by the caller after this
  // resolves — see /api/attachments/upload and compose-form.tsx.)
  try {
    const recipients = await resolveRecipients(
      input.scopeType,
      input.classSectionIds,
      input.studentIds,
      input.groupIds
    );
    await fanOut(message.id, input.subject, input.body, input.urgent, recipients);
  } catch (err) {
    console.error("[messages] delivery fan-out failed:", (err as Error).message);
  }

  revalidatePath("/console/messages");
  return message.id as string;
}

/** Creates a reusable custom group from a set of students, so a broadcast can be
 * re-targeted later without re-picking everyone. Returns the new group id. */
export async function createCustomGroup(name: string, studentIds: string[]): Promise<string> {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") throw new Error("Not signed in as staff");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the group a name");
  if (studentIds.length === 0) throw new Error("Pick at least one student first");

  const supabase = await createClient();
  const { data: group, error } = await supabase
    .from("custom_groups")
    .insert({ name: trimmed, created_by: viewer.staff.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const rows = [...new Set(studentIds)].map((id) => ({
    custom_group_id: group.id,
    student_id: id,
  }));
  const { error: membersError } = await supabase.from("custom_group_students").insert(rows);
  if (membersError) throw new Error(membersError.message);

  revalidatePath("/console/messages");
  return group.id as string;
}
