# 02 — Architecture & Trust Boundaries

This document describes the physical and logical architecture, the request
lifecycle, the layered access-control model, and every trust boundary the data
crosses. It is the map the data-flow document (04) and security document (05)
build on.

---

## 1. Technology stack

| Layer | Technology | Version (from `package.json`) | Role |
|-------|-----------|-------------------------------|------|
| Framework | Next.js (App Router) | 16.2.12 | SSR pages, server actions, route handlers, proxy. |
| UI runtime | React / React DOM | 19.2.4 | Component rendering. |
| Language | TypeScript | ^5 | End-to-end typing. |
| Styling | Tailwind CSS | ^4 | Styling. |
| Animation | framer-motion | ^12 | UI motion. |
| Database + Auth | Supabase (PostgreSQL) | `@supabase/supabase-js` ^2.111, `@supabase/ssr` ^0.12 | Relational store, RLS, authentication. |
| File storage | Firebase Cloud Storage | `firebase` ^12, `firebase-admin` ^14 | PDFs and attachments. |
| External data | Google APIs (Sheets + Drive) | `googleapis` ^176 | Roster/academic sync. |
| Web Push | web-push | ^3.6 | Browser push notifications. |
| Bulk files | jszip | ^3.10 | Bulk report-card ZIP handling. |
| QR | qrcode | ^1.5 | Student QR rendering. |
| Test | Playwright | ^1.62 | E2E smoke tests. |
| Hosting | Vercel (region `bom1`) | — | App hosting + cron. |

**Build note:** `next.config.ts` sets `output: "standalone"` so a self-contained
Node server bundle is emitted (used by `Dockerfile`).

---

## 2. Component diagram

```
                         ┌──────────────────────────────────────────────┐
                         │              Browser (PWA)                     │
                         │  Guardian Portal  ·  Staff Console             │
                         │  Service worker (push)  ·  httpOnly session    │
                         └───────────────┬──────────────────────────────┘
                                         │ HTTPS (Supabase auth cookie)
                                         ▼
             ┌──────────────────────────────────────────────────────────┐
             │                 Next.js app (Vercel)                       │
             │                                                            │
             │  proxy.ts ──── refreshes session on matched routes         │
             │      │         (NOT access control)                        │
             │      ▼                                                      │
             │  Route-group layouts: (parent)/  (staff)/                  │
             │      │  coarse guard: redirect if wrong viewer type        │
             │      ▼                                                      │
             │  getViewer() / requirePrincipal() / requireSuperAdmin()    │
             │      │  identity + role gate                               │
             │      ▼                                                      │
             │  Server Components · Server Actions · Route Handlers        │
             │      │                         │                           │
             │      │ anon-key client         │ service-role client       │
             │      │ (RLS enforced)          │ (RLS BYPASSED, 14 sites)  │
             └──────┼─────────────────────────┼───────────────────────────┘
                    ▼                         ▼
        ┌───────────────────────┐   ┌──────────────────────────────────┐
        │   Supabase Postgres    │   │  Side channels (server-only)      │
        │  ~49 tables, RLS on     │   │  • Firebase Storage (Admin SDK)   │
        │  every table            │   │  • Google Sheets + Drive (SA)     │
        │  SECURITY DEFINER fns    │   │  • web-push / FCM (VAPID)         │
        │  Supabase Auth (users)  │   │  • SMS relay (Android phone)      │
        └───────────────────────┘   │  • WhatsApp click-to-chat (link)  │
                    ▲                 └──────────────────────────────────┘
                    │ Bearer CRON_SECRET
        ┌───────────┴───────────┐
        │  Vercel Cron (daily)   │ → GET /api/cron/tick
        └───────────────────────┘
```

---

## 3. Route topology

The app uses Next.js **route groups** to separate the two audiences. Group folders
in parentheses do not appear in the URL.

| Route group | URL prefix | Layout guard | Contents |
|-------------|-----------|--------------|----------|
| `src/app/(parent)/` | `/` (e.g. `/home`, `/attendance`) | Redirect if the viewer is not a guardian | All parent pages: home, attendance, results, timetable, homework, leave, stay-back, ptm, consultations, messages, payments, gallery, competitions, defaulters, dtr, report-issue, settings. |
| `src/app/(staff)/console/` | `/console/**` | Redirect if the viewer is not staff | All console pages: attendance, classes, results, timetable, homework, leave, stay-back, ptm, consultations, messages (compose/groups/permissions), issues, parents, students, staff, qr-codes, report-cards, competitions, defaulters, gallery, calendar, notification-log, storage, sync. |
| `src/app/auth/` | `/auth/**` | none (public) | `callback`, `reset-password`. |
| `src/app/activate/` | `/activate` | none (public) | Account activation (proof-of-ownership). |
| `src/app/post-login/` | `/post-login` | authenticated | Routes a signed-in user to portal or console. |
| `src/app/api/` | `/api/**` | per-handler auth | Route handlers (uploads, exports, cron). Excluded from the proxy matcher. |

The layouts are the **coarse** guard: they keep a parent out of the console URL
space and vice-versa. They are convenience, not the security guarantee — see the
layered model in §5.

---

## 4. Request lifecycle

### 4.1 A page render (Server Component)
1. Browser requests a route with its Supabase auth cookie.
2. `proxy.ts` (matched routes only) calls `updateSession()` to refresh the auth
   token and set fresh cookies (`src/lib/supabase/middleware.ts`). This does **not**
   authorize anything.
3. The route-group layout calls `getViewer()`; if the viewer type is wrong for the
   group, it redirects.
4. Server Components query Postgres through the **anon-key** SSR client
   (`src/lib/supabase/server.ts`). Every query is filtered by RLS according to the
   caller's JWT — a parent physically cannot receive another family's rows.

### 4.2 A mutation (Server Action)
1. The client invokes a `"use server"` action as a same-origin POST. Next 16
   enforces an origin/host allowlist on server actions (CSRF backstop).
2. The action calls `getViewer()` and the appropriate role gate
   (`requirePrincipal()` / `requireSuperAdmin()` / an explicit ownership check).
3. It validates inputs, then writes through either:
   - the **anon-key** client (RLS re-checks the write), or
   - the **service-role** client (RLS bypassed) **only** where cross-cutting work
     is legitimately needed (e.g. creating an approval chain, resolving broadcast
     recipients). Every such site re-implements the authorization the DB would
     have done (see doc 05 §6).
4. `revalidatePath()` refreshes affected server-rendered views.

### 4.3 A file upload / export / cron (Route handler)
- Uploads (`/api/attachments/upload`, `/api/report-card/*`) validate the session
  and ownership, sanitize paths, and write via the Firebase Admin SDK.
- Exports (`/api/export/*`) stream RLS-scoped data as CSV (with formula-injection
  escaping, `src/lib/csv.ts`).
- Cron (`/api/cron/tick`) requires a `Bearer CRON_SECRET` header and fails closed
  if the secret is unset (`route.ts:15-22`).

---

## 5. The layered access-control model (defense in depth)

Access control is enforced at four layers, each independently:

| Layer | Mechanism | Strength | Bypassable? |
|-------|-----------|----------|-------------|
| 1. Proxy | `proxy.ts` session refresh | none (not access control) | n/a |
| 2. Layout | route-group redirect on wrong viewer type | coarse | Yes — treated as UX only |
| 3. Server action / route gate | `getViewer` + `requirePrincipal`/`requireSuperAdmin`/ownership check | medium | Yes if code is wrong |
| 4. **Postgres RLS** | per-table policies keyed on `current_guardian_id()` / `current_staff_role()` | **authoritative** | **No** (for anon-key clients) |

> **Central design principle** (from `SECURITY_AUDIT.md` §2): *if the layout and
> action check were bypassed, RLS must still stop the access.* RLS is the last line
> and independently enforces every rule. The one place RLS does not apply is the
> service-role client — which is why those 14 call sites are the highest-risk
> surface and each must re-authorize (doc 05 §6).

---

## 6. The two database clients

| Client | File | Key | RLS | Use |
|--------|------|-----|-----|-----|
| SSR anon client | `src/lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Enforced** | All normal reads/writes on behalf of the signed-in user. Reads the session from cookies. |
| Browser client | `src/lib/supabase/client.ts` | anon | Enforced | Client-side interactions (e.g. auth UI, optimistic toggles). |
| Service-role admin client | `src/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | **Bypassed** | Trusted background work only; `server-only`, never shipped to browser. |

The admin client is imported at exactly these locations (verified by grep):

```
src/app/(parent)/report-issue/actions.ts
src/app/(parent)/stay-back/actions.ts
src/app/(staff)/console/messages/compose/actions.ts
src/app/(staff)/console/staff/actions.ts
src/app/(staff)/console/sync/pending-deletions/actions.ts
src/app/activate/actions.ts
src/app/api/attachments/upload/route.ts
src/app/api/report-card/bulk-upload/route.ts
src/app/api/report-card/upload/route.ts
src/lib/google-sheets.ts
src/lib/homework-notify.ts
src/lib/notifications/push.ts
src/lib/reference-data.ts
src/lib/supabase/admin.ts   (the factory itself)
```

Each non-factory site is analysed in doc 05 §6.

---

## 7. Trust boundaries

A trust boundary is any point where data crosses from a less-trusted to a
more-trusted context (or vice-versa). Each is a place controls must exist.

| # | Boundary | Direction | Control(s) |
|---|----------|-----------|------------|
| TB-1 | Browser ↔ Next server | untrusted → trusted | Supabase httpOnly session cookie; `auth.getUser()` validates the JWT server-side (not `getSession`); Next server-action origin allowlist; security headers. |
| TB-2 | Next server ↔ Postgres | trusted app → data | Anon-key client subject to RLS; service-role client restricted to server-only trusted work with re-authorization. |
| TB-3 | Next server ↔ Firebase Storage | trusted app → files | Admin SDK with a service-account key; Storage rules deny all direct client access; upload paths server-generated + filename sanitized. |
| TB-4 | Next server ↔ Google Sheets/Drive | trusted app ↔ external doc | Service-account JWT; sheet ID is server config, not user input; per-row validation on import; deletions queued not applied. |
| TB-5 | Next server ↔ web-push/FCM | trusted app → device | VAPID key pair (private key server-only); per-category preference filter; dead-subscription pruning. |
| TB-6 | Next server ↔ SMS relay | trusted app → phone | Bearer token to the relay; relay is a school-owned device. |
| TB-7 | Vercel Cron ↔ app | scheduler → trusted | `Bearer CRON_SECRET`, fail-closed if unset. |
| TB-8 | Repo/CI ↔ secrets | developer → secrets | `.gitignore` for all credential files; no secret under `NEXT_PUBLIC_` except intended public values; verified absent from git history (`SECURITY_AUDIT.md`). |

---

## 8. Deployment topology

- **Primary hosting:** Vercel, region `bom1` (Mumbai) — see `vercel.json`.
- **Scheduled job:** Vercel Cron, `0 3 * * *` (daily 03:00 UTC ≈ 08:30 IST) →
  `GET /api/cron/tick`.
- **Database & Auth:** Supabase managed Postgres (project ref
  `symyylbkadpzzyncwjbd`).
- **Files:** Firebase Cloud Storage bucket (`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`).
- **Alternate packaging:** `Dockerfile` builds the standalone bundle for any Node
  host; `.dockerignore` excludes env/keys; `firebase.json`/`.firebaserc` exist for
  Firebase tooling.
- **Configuration:** all secrets via environment variables (see doc 10 §2 and
  `.env.example`). No secrets are committed.

See `10-operations-and-runbook.md` for the full environment matrix, backup, and
incident procedures.
