import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFileAdmin } from "@/lib/firebase/admin-storage";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff") {
    return NextResponse.json({ error: "Not signed in as staff" }, { status: 401 });
  }

  const form = await request.formData();
  const messageId = form.get("messageId");
  const file = form.get("file");
  if (typeof messageId !== "string" || !messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
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

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `message-attachments/${messageId}/${file.name}`;

  try {
    const storageUrl = await uploadFileAdmin(storagePath, bytes, file.type);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("message_attachments")
      .insert({
        message_id: messageId,
        file_name: file.name,
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
