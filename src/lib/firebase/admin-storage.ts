import "server-only";
import { randomUUID } from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

// Server-only counterpart to src/lib/firebase/storage.ts. Storage rules deny
// all client access by design (see that file's comment) — this is the actual
// write path, authenticated via a service-account key rather than Firebase
// Auth, and it's the only thing allowed to touch the bucket.
function adminApp() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error(
      "Firebase Admin needs FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    })
  );
}

/** Uploads a file's bytes to Storage under `path` and returns a permanent
 * token-based download URL — the same format the Firebase client SDK's
 * `getDownloadURL()` produces. That token deliberately bypasses Storage
 * Security Rules (it's a bearer credential in the URL), which is what makes
 * it usable from this app even with rules set to deny all client access. */
export async function uploadFileAdmin(
  path: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const bucket = getStorage(adminApp()).bucket();
  const file = bucket.file(path);
  const downloadToken = randomUUID();

  await file.save(bytes, {
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    path
  )}?alt=media&token=${downloadToken}`;
}
