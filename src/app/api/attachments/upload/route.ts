import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFileAdmin } from "@/lib/firebase/admin-storage";

const MAX_BYTES = 10 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strips any directory component and unsafe characters so a crafted filename
 * can't escape the message's storage folder or collide with another path. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 128);
  return cleaned || "attachment.pdf";
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") {
    return NextResponse.json({ error: "Not signed in as staff" }, { status: 401 });
  }

  const form = await request.formData();
  const messageId = form.get("messageId");
  const file = form.get("file");
  if (typeof messageId !== "string" || !UUID_RE.test(messageId)) {
    return NextResponse.json({ error: "Valid messageId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF attachments are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (10MB max)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Only the staff member who sent the message may attach to it — otherwise any
  // staff could bolt a file onto anyone else's broadcast.
  const { data: message } = await admin
    .from("messages")
    .select("sender_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  if (message.sender_id !== viewer.staff.id) {
    return NextResponse.json({ error: "You can only attach to your own messages" }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = safeFileName(file.name);
  const storagePath = `message-attachments/${messageId}/${fileName}`;

  try {
    const storageUrl = await uploadFileAdmin(storagePath, bytes, file.type);
    const { data, error } = await admin
      .from("message_attachments")
      .insert({
        message_id: messageId,
        file_name: fileName,
        size_bytes: file.size,
        storage_url: storageUrl,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
