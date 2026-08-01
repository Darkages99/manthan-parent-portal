import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase is used strictly for file storage — report card PDFs, fee
// receipts, and message attachments — to stay on Supabase's free tier for
// the database while getting Firebase's larger free storage allowance.
// Everything relational (who a file belongs to, permissions) stays in
// Supabase Postgres; Firebase Storage only ever holds the bytes.
//
// Deployed Storage rules currently deny all client access ("allow read,
// write: if false"), which is deliberate: the app authenticates through
// Supabase, not Firebase Auth, so request.auth in Storage rules would
// never be populated and open rules would mean an unauthenticated public
// bucket. Uploads instead go through a Next.js Route Handler using the
// Firebase Admin SDK, checked against the Supabase session server-side —
// see src/lib/firebase/admin-storage.ts and /api/attachments/upload for the
// message-attachments path this powers today. `uploadFile` below is unused
// client-side scaffolding for a future report-card/receipt upload path.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

function app() {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

/** Uploads a file under a given path (e.g. `message-attachments/<messageId>/<fileName>`) and returns its public download URL. */
export async function uploadFile(path: string, file: File): Promise<string> {
  const storage = getStorage(app());
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
