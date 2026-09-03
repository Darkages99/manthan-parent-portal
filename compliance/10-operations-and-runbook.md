# 10 — Operations & Runbook

How the system is configured, built, deployed, scheduled, backed up, monitored, and
recovered. This is the operator's reference.

---

## 1. Runtime topology (recap)

| Concern | Where |
|---------|-------|
| App hosting | Vercel, region `bom1` (Mumbai) |
| Scheduled job | Vercel Cron `0 3 * * *` → `GET /api/cron/tick` |
| Database + Auth | Supabase managed Postgres (ref `symyylbkadpzzyncwjbd`) |
| File storage | Firebase Cloud Storage bucket |
| Roster source | Google Sheet (service-account access) |
| Alternate packaging | Docker (`Dockerfile`, standalone Next output) |

---

## 2. Environment variables (full matrix)

Source: `.env.example`. Set in Vercel project settings (and `.env.local` for local
dev). **Secrets must never be committed.**

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | RLS-bound client key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | RLS-bypass admin key (server-only) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | public | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | public | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | public | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | public | Storage bucket name |
| `FIREBASE_ADMIN_PROJECT_ID` | **secret** | Admin SDK |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | **secret** | Admin SDK |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **secret** | Admin SDK (newlines `\n`-escaped) |
| `SMS_GATEWAY_URL` | **secret** | Android SMS relay endpoint |
| `SMS_GATEWAY_TOKEN` | **secret** | SMS relay bearer token |
| `NEXT_PUBLIC_SCHOOL_WHATSAPP_NUMBER` | public | WhatsApp click-to-chat sender |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public | Web Push public key |
| `VAPID_PRIVATE_KEY` | **secret** | Web Push private key |
| `VAPID_SUBJECT` | config | Push contact URI (defaults to a mailto) |
| `CRON_SECRET` | **secret** | Cron bearer secret (fail-closed if unset) |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | **secret** | Sheets service account |
| `GOOGLE_SHEETS_PRIVATE_KEY` | **secret** | Sheets service account (`\n`-escaped) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | config | Target spreadsheet |

**Pre-deploy checklist:** all secrets present and non-empty (especially
`CRON_SECRET` — an empty value makes cron 401 by design); no secret prefixed
`NEXT_PUBLIC_`; service-account keys least-privilege.

---

## 3. Build & deploy

### 3.1 Local development
```
npm install
# populate .env.local (see §2)
npm run dev            # http://localhost:3000
```

### 3.2 Verification (do NOT rely on offline build)
```
npx tsc --noEmit
npx eslint src
npm run test           # Playwright E2E
```
`next build` fetches Google Fonts and fails offline — use the above for local
verification (see doc 08 §2).

### 3.3 Production deploy
- Push to `origin/master`; Vercel builds and deploys automatically.
- Build uses `output: "standalone"` (`next.config.ts`).
- Verify on the Vercel deployment URL after each push.

### 3.4 Container deploy (alternative)
```
docker build -t manthan-portal .
docker run --env-file .env.production -p 3000:3000 manthan-portal
```
`.dockerignore` excludes env/keys; secrets are injected at runtime.

---

## 4. Database migrations

- Migrations live in `supabase/migrations/NNNN_*.sql`, applied in order.
- Apply via Supabase MCP `apply_migration` or the Supabase CLI (`supabase db push`).
- **Order matters:** `0001_init.sql` creates the RLS helper functions before later
  policy migrations reference them.
- After any RLS/policy migration, run the impersonation regression suite (doc 08 §4)
  before considering it done.
- Generated types: `src/lib/supabase/database.types.ts` (regenerate after schema
  changes so the app's typed contract stays accurate).

---

## 5. Scheduled jobs

| Job | Trigger | Effect | Auth |
|-----|---------|--------|------|
| Roster sync | daily cron + manual "Sync now" (console/sync) | reconcile Sheet → Postgres, queue deletions | service-role + `CRON_SECRET` on the route |
| Homework not-submitted notify | daily cron | push to guardians of students with unsubmitted homework (deduped) | service-role |

Both run inside `GET /api/cron/tick` under `Promise.allSettled`; one failing does
not sink the other; the route returns per-job status.

**Manual re-run:** hit `/api/cron/tick` with the correct `Authorization: Bearer
<CRON_SECRET>` header (safe/idempotent), or use the console "Sync now" control.

---

## 6. Storage operations

- All file I/O goes through server route handlers using the Firebase Admin SDK;
  direct client access is denied by `storage.rules`.
- **Usage monitoring:** a principal computes a snapshot on the console
  (`console/storage`) → `storage_usage_snapshots` (DB bytes via
  `database_size_bytes()`, file bytes via `getBucketUsageBytes()`). Use this to
  decide when to archive/reset (see the retention gap in doc 09 §4).

---

## 7. Backup & recovery

| Asset | Backup mechanism | Recovery |
|-------|------------------|----------|
| Postgres data | Supabase automated backups / PITR (managed) | Restore via Supabase; re-run migrations if rebuilding a project |
| Firebase Storage objects | Firebase/GCS bucket durability; add scheduled export for point-in-time | Objects addressed by token URL stored on DB rows |
| Google Sheet | Google Drive version history | Re-provision with `provisionSheet()` if lost; an empty tab re-seeds from Postgres on next sync |
| Schema | `supabase/migrations/*` in git | `supabase db push` on a fresh project |
| Secrets | out-of-band secure store (not git) | Re-enter in Vercel |

**Rebuild-from-scratch order:** provision Supabase project → apply migrations
`0001…0052` → set env → provision/point the Sheet → first sync seeds/loads roster →
verify with the RLS suite.

---

## 8. Monitoring & observability

- **Application logs:** Vercel function logs (server `console.error` for sync
  failures, push failures, etc.). Note these may contain PII/error detail — see doc
  09 §6.
- **Sync health:** `sheet_sync_runs` (status/error_summary) — surfaced in
  `console/sync`.
- **Notification delivery:** `notification_log.delivered` flag per attempt.
- **DB advisors:** Supabase `get_advisors` (security + performance) — run
  periodically.
- **Dependency health:** `npm audit` — residual advisories tracked in
  `SECURITY_AUDIT.md` F9.

---

## 9. Incident response (quick reference)

| Incident | First actions |
|----------|---------------|
| Suspected data exposure | Identify the table/flow; run the RLS impersonation test for it (doc 08 §4); check `SECURITY_AUDIT.md`; rotate any implicated key. |
| Leaked secret | Rotate the key in the provider + Vercel immediately; confirm it was never in git (`git log --all -- <file>`); redeploy. |
| Cron not running / sync stale | Check `CRON_SECRET` set and non-empty; check last `sheet_sync_runs` row; manually trigger `/api/cron/tick`. |
| Bad roster deletion queued | It is only queued, not applied — do not confirm; fix the Sheet so the row reappears; next sync clears the queue entry. |
| Accidental confirmed deletion | Restore from Supabase backup / re-add the row in the Sheet and re-sync. |
| Push failures spike | Check VAPID env; dead endpoints auto-prune on 404/410; inspect `notification_log`. |
| Firebase upload failures | Verify `FIREBASE_ADMIN_*` env + service-account permissions. |

---

## 10. Routine operational calendar (suggested)

| Cadence | Task |
|---------|------|
| Daily (auto) | Cron: roster sync + homework notify |
| Weekly | Review `sheet_sync_runs` failures; skim `notification_log` delivery rate |
| Monthly | `npm audit`; Supabase `get_advisors`; storage-usage snapshot review |
| Term / year-end | Archive + reset per retention policy (doc 09 §4); rotate secrets; review staff roster & roles |
| After any change | Regression gate (doc 08 §10) |
