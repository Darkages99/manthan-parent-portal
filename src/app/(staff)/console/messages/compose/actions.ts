"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import type { Enums } from "@/lib/supabase/database.types";

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

  // TODO: attachment upload needs a server route on the Firebase Admin SDK
  // (see src/lib/firebase/storage.ts) — Storage rules are closed until then.
  // TODO: sendPush(...) to resolved recipients, and getSmsRelay().send(...)
  // per recipient when input.urgent is true, once the relay phone is set up.

  revalidatePath("/console/messages/compose");
  return message.id as string;
}
