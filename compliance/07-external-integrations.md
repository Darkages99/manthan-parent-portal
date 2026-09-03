# 07 — External Integrations

Every system the portal talks to outside its own database, what data crosses the
boundary, the credentials used, and the failure behaviour. Boundaries are the
TB-* set from `02-architecture-and-trust-boundaries.md` §7.

---

## 1. Supabase (PostgreSQL + Auth) — TB-2
- **Role:** primary database and identity provider.
- **Project:** ref `symyylbkadpzzyncwjbd` (from `SECURITY_AUDIT.md`).
- **Clients:** anon-key SSR/browser clients (RLS enforced); service-role admin
  client (RLS bypassed, server-only). See doc 02 §6.
- **Credentials:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (public), `SUPABASE_SERVICE_ROLE_KEY` (secret, server-only).
- **Data crossing:** all relational data; auth tokens in httpOnly cookies.
- **Failure behaviour:** query errors surface as generic errors to the client;
  server logs the detail. No PII in client-facing error text.

## 2. Firebase Cloud Storage — TB-3
- **Role:** file store for report-card PDFs, payment receipts, message attachments.
- **Access model:** **all direct client access denied** by `storage.rules`
  (`allow read, write: if false`). Reads/writes go only through server route
  handlers using the Firebase **Admin SDK** (`src/lib/firebase/admin-storage.ts`),
  authenticated by a service-account key (not Firebase Auth — the app authenticates
  via Supabase).
- **Credentials:** `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY` (secret), `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  (+ web config `NEXT_PUBLIC_FIREBASE_*`).
- **Download model:** `uploadFileAdmin()` writes an object with a random
  `firebaseStorageDownloadTokens` UUID and returns a token URL. That URL is a
  bearer credential that intentionally bypasses Storage rules — knowledge of the
  URL grants read. URLs are stored on the owning DB rows and only reach a user who
  can read that row (RLS).
- **Path safety:** upload paths are server-generated; user filenames are sanitized
  to a basename; `messageId` is UUID-validated (finding F7). Bulk ZIP entries are
  path-checked (zip-slip guard).
- **Usage metering:** `getBucketUsageBytes()` paginates all objects for the storage
  snapshot.
- **Failure behaviour:** missing admin env → thrown config error at first use;
  uploads that fail return an error to the caller; the DB row simply keeps no URL.

## 3. Google Sheets + Drive — TB-4
- **Role:** the roster / academic-config source of truth (students, guardians,
  staff, class sections, subjects, timetable). Managed by school staff in a sheet;
  synced into Postgres.
- **Auth:** a Google service-account JWT (`google.auth.JWT`) with scopes
  `spreadsheets` + `drive` (`src/lib/google-sheets.ts:28-52`).
- **Credentials:** `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`
  (secret), `GOOGLE_SHEETS_SPREADSHEET_ID` (config).
- **Data crossing:** roster PII **out** to the sheet (seed/export + status
  write-back) and **in** to Postgres (import). The sheet is shared (Drive
  permissions) only with principal/super_admin staff who have an email on file.
- **Tab contract:** fixed column order per tab (`TAB_HEADERS`), last column is
  "Sync Status". A dedicated red-highlighted "Pending Deletions" tab mirrors the
  unresolved deletion queue.
- **Safety model:** additions/amendments auto-apply; **deletions are queued, never
  applied** (`sheet_sync_pending_deletions`); only a super_admin confirms. Per-row
  validation writes an error into that row's status cell without aborting the tab.
  Guardian upsert uses the atomic `sync_upsert_guardian` RPC to satisfy integrity
  triggers.
- **Failure behaviour:** `syncFromSheet()` never throws — it always closes a
  `sheet_sync_runs` row as `success` or `failed` with an `error_summary`.
- **Governance note:** roster PII resides in a Google Sheet outside the primary
  database. This is an intentional operational choice; it is called out as a
  data-residency consideration in `09-data-governance-and-privacy.md`.

## 4. Web Push / FCM — TB-5
- **Role:** browser push notifications to opted-in guardian/staff devices.
- **Library/auth:** `web-push` with a VAPID key pair. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  ships to the browser; `VAPID_PRIVATE_KEY` is server-only; `VAPID_SUBJECT` is a
  contact URI. Generate with `npm run vapid:keys`.
- **Data crossing:** notification title/body/url out to the push service; device
  subscription (`endpoint`, `p256dh`, `auth`) stored in `push_subscriptions`.
- **Choke point:** all sends go through `sendPush()` (`src/lib/notifications/push.ts`)
  which filters by `notification_preferences`, fans out per device, prunes dead
  endpoints (404/410), and writes a `notification_log` row per target.
- **Constraints:** iOS Safari needs 16.4+ and home-screen install; urgent messages
  should also use SMS.
- **Failure behaviour:** if VAPID keys are unset, `sendPush` no-ops with a warning
  (does not throw) — NFR-10.

## 5. SMS relay (Android phone) — TB-6
- **Role:** zero-marginal-cost SMS fallback for urgent 1:1 messages.
- **Model:** a school-owned Android device runs an `android-sms-gateway`-style
  relay exposing `POST /message`; the server calls it with a Bearer token
  (`src/lib/notifications/sms.ts`).
- **Credentials:** `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`.
- **Failure behaviour:** if unconfigured, a `NoopSmsRelay` logs the intended send
  and returns `{ ok:false }` — nothing throws. Swapping in a paid gateway is a
  one-file change (the `SmsRelay` interface).

## 6. WhatsApp click-to-chat — (browser-initiated)
- **Role:** high-urgency 1:1 nudge (e.g. stay-back approval ping to one teacher).
- **Model:** `buildWhatsAppLink()` produces a `wa.me/<digits>?text=<encoded>` URL;
  opening it pre-fills a message a human then sends. There is **no** WhatsApp
  Business API — nothing is sent automatically, so it is not viable for broadcast.
- **Credentials:** `NEXT_PUBLIC_SCHOOL_WHATSAPP_NUMBER` (the sender number).
- **Failure behaviour:** purely client-side; no server dependency.

## 7. Vercel Cron — TB-7
- **Role:** daily scheduled trigger.
- **Schedule:** `0 3 * * *` (03:00 UTC ≈ 08:30 IST), region `bom1` (`vercel.json`).
- **Endpoint:** `GET /api/cron/tick`, guarded by `Authorization: Bearer CRON_SECRET`
  (fail-closed if unset). Runs `syncFromSheet()` + `notifyUnsubmittedHomework()`
  via `Promise.allSettled` (one failing job does not sink the other).
- **Credentials:** `CRON_SECRET`.

## 8. Integration credential matrix

| Integration | Env vars | Public? | Failure mode |
|-------------|----------|---------|--------------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | required — app can't run |
| Supabase admin | `SUPABASE_SERVICE_ROLE_KEY` | secret | required for background/admin |
| Firebase Storage | `FIREBASE_ADMIN_*`, `NEXT_PUBLIC_FIREBASE_*` | mixed | file ops fail if unset |
| Google Sheets | `GOOGLE_SHEETS_CLIENT_EMAIL/PRIVATE_KEY/SPREADSHEET_ID` | secret | sync fails, logged; app runs |
| Web Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | mixed | no-op if unset |
| SMS relay | `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN` | secret | no-op if unset |
| WhatsApp | `NEXT_PUBLIC_SCHOOL_WHATSAPP_NUMBER` | public | client-only |
| Cron | `CRON_SECRET` | secret | endpoint 401s if unset |
