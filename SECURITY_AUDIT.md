# Manthan Parent Portal — Comprehensive Security Analysis & Audit Plan

> **Status:** Living document. Section 1–9 define *what* we audit and *how* we test it. Section 10 is the running **findings tracker** filled in as the audit executes.
>
> **A note on "100% secure":** No non-trivial networked system can be *proven* 100% secure — that is not an achievable or honest guarantee. What this document *does* commit to is: (a) enumerating every class of attack relevant to this app, (b) checking every table, RLS policy, route, server action, and secret against it, and (c) leaving a concrete, reproducible test for each so the posture can be re-verified after any change. The goal is **no known exploitable vulnerability, defense-in-depth on every trust boundary, and a repeatable way to prove it.**

---

## 1. Scope & Methodology

### 1.1 What's in scope
- **Every line of application code** under `src/` (server components, client components, server actions, route handlers, libs).
- **Every database object**: all 48 tables, their RLS policies, `SECURITY DEFINER` functions, triggers, views, and grants (`supabase/migrations/*.sql` + live DB via Supabase MCP).
- **Every trust boundary**: browser ↔ server, server ↔ Postgres, server ↔ Firebase Storage, server ↔ Google Sheets, server ↔ web-push/FCM, Vercel Cron ↔ app.
- **Secrets & credentials**: `.env*`, service-account JSON files, OAuth client secrets, VAPID keys, git history.
- **Configuration**: `next.config.ts`, `proxy.ts` matcher, `vercel.json`, `storage.rules`, `Dockerfile`, headers.
- **Dependencies**: `package.json` / `package-lock.json` for known CVEs.

### 1.2 Method
1. **Static review** — read every server action and route handler for the auth → authorize → validate → act → respond chain.
2. **Data-flow / taint analysis** — trace every user-controlled input to every sink (SQL, storage path, HTML, redirect, shell, external API).
3. **RLS impersonation testing** — for each table, run positive and negative queries as a guardian and as each staff role via `set_config('request.jwt.claims', …)` in one `execute_sql` call (service-role MCP otherwise bypasses RLS).
4. **Secrets & git-history scan.**
5. **Dependency CVE scan.**
6. **Config & header review.**
7. Each finding logged in §10 with severity (CVSS-style), reproduction, and fix.

### 1.3 Verification constraints (this repo)
- `npm run build` fails offline (Google Fonts fetch) — **verify with `npx tsc --noEmit` + `npx eslint src`**, not a full build.
- DB/RLS changes: apply via Supabase MCP `apply_migration` (project `symyylbkadpzzyncwjbd`), test by impersonation. Service-role MCP bypasses RLS, so **always** `set local role authenticated` + set JWT claims when testing a policy.

---

## 2. Architecture & Trust Boundaries

```
Browser (guardian PWA / staff console)
  │  Supabase auth cookie (SSR, httpOnly)
  ▼
src/proxy.ts  ── refreshes session on every matched route (NOT access control)
  ▼
Route-group layouts  (parent)/layout.tsx, (staff)/layout.tsx  ── coarse guard: redirect if wrong viewer type
  ▼
getViewer()  (src/lib/session.ts) ── resolves auth.uid → guardians row OR active staff row
requirePrincipal()/requireSuperAdmin() (src/lib/roles.ts) ── per-action role gate
  ▼
Anon-key Supabase client (server.ts / client.ts) ── ALL queries pass through Postgres RLS
Service-role client (admin.ts) ── BYPASSES RLS; 13 call sites — the highest-risk surface
  ▼
Postgres: 48 tables, RLS on every table, SECURITY DEFINER helper fns (current_staff_role(), etc.)

Side channels:
  • Firebase Storage (attachments, report cards) — storage.rules + admin-storage.ts
  • Google Sheets sync (roster/academic config) — lib/google-sheets.ts via service account
  • web-push / FCM — push_subscriptions, VAPID keys
  • Vercel Cron → /api/cron/tick — Bearer CRON_SECRET
```

**Core security model:** Defense in depth — layouts (coarse) + server-action role guards (medium) + Postgres RLS (authoritative). RLS is the last line and must independently enforce every access rule; UI/action checks are convenience, not the guarantee. **The audit's central question for every path: "If the layout and action check were bypassed, does RLS still stop it?"**

---

## 3. Threat Model — Attacker Profiles

| # | Attacker | Capability | Primary goal |
|---|----------|-----------|--------------|
| A1 | **Unauthenticated internet** | Can hit any URL/route/API, no cookie | Reach data or actions without logging in |
| A2 | **Authenticated guardian** | Valid parent session; owns children X,Y | Read/modify *other* families' data (IDOR), escalate to staff |
| A3 | **Malicious guardian w/ crafted requests** | Bypasses UI, calls server actions / route handlers directly with forged IDs/payloads | Tamper with results, attendance, leave, messages; access other students |
| A4 | **Low-privilege staff** (teacher/class_teacher/coordinator) | Valid staff session | Act beyond assigned classes/scope; escalate to principal/super_admin |
| A5 | **Compromised push/sheet/cron channel** | Knows/guesses a secret or endpoint | Trigger admin sync, spoof cron, exfiltrate via notifications |
| A6 | **Supply chain / dependency** | Malicious or vulnerable npm package | RCE, data theft at build/runtime |
| A7 | **Insider with repo access** | Reads source & config | Harvest committed secrets |
| A8 | **Network / browser-level** | XSS, CSRF, clickjacking, MITM | Hijack sessions, run actions as victim |

---

## 4. Vulnerability Catalog

Each item: **what it is → where it could live in *this* app → how we test → remediation bar.**

### 4.1 Broken Access Control / IDOR  *(highest priority for this app)*
- **Where:** Every server action in `src/app/**/actions.ts` (32 files) and every route handler (11) that accepts an ID (`student_id`, `guardian_id`, `message_id`, `class_section_id`, `homework_id`, `meeting_id`, …). Every `createAdminClient()` call site (13) that skips RLS.
- **Tests:**
  - For each guardian-facing action, call it as guardian A with an ID belonging to guardian B's child → must be denied by an ownership check *and* RLS.
  - For each staff action gated only by `requirePrincipal()`, confirm teachers/coordinators can't reach principal-only actions.
  - For each `createAdminClient()` site: confirm the code re-authorizes the caller and constrains rows to what the caller may see (admin client trusts nothing from RLS).
  - RLS impersonation matrix (§5) for every table.
- **Bar:** No object reachable by ID without an ownership/scope check enforced at the DB layer.

### 4.2 SQL Injection
- **Where:** Any raw SQL, `.rpc()` with string interpolation, `.or()`/`.filter()` built from user strings, dynamic `execute_sql`. Supabase query builder is parameterized by default, so risk concentrates in `.or(\`...${input}...\`)` string filters and any `SECURITY DEFINER` fn using `EXECUTE`.
- **Tests:** grep for template-literal filters and string-concatenated SQL; attempt `'`, `,`, `)` breakouts in any such filter; review every SECURITY DEFINER function body.
- **Bar:** No user input reaches SQL as a string fragment; all filters use typed builder args.

### 4.3 Authentication & Session
- **Where:** `getViewer()`, `proxy.ts`, auth callback (`/auth/callback`), password reset (`/auth/reset-password`), activation (`/activate`), post-login routing.
- **Tests:** confirm `getViewer` uses `auth.getUser()` (validates JWT server-side) not `getSession()` (trusts cookie); inactive staff (`active=false`) fully locked out; deactivated guardian's links revoked; session cookies httpOnly/secure/sameSite; open-redirect check on `redirectTo`/`next` params in auth callback.
- **Bar:** No trust of unvalidated cookies; no privilege retained after deactivation; no open redirect.

### 4.4 Privilege Escalation (guardian→staff, teacher→principal)
- **Where:** `staff` table writes, role column updates, `activate/actions.ts`, `console/staff/actions.ts`, message-send-permission grants, RLS policies keyed on `current_staff_role()`.
- **Tests:** attempt to insert/update own `staff` row or `role`; attempt to self-grant message permissions; verify `current_staff_role()` can't be spoofed; verify a guardian can't create a staff row linked to their `auth_user_id`.
- **Bar:** Role is only mutable by super_admin via a guarded path; RLS blocks self-elevation.

### 4.5 Injection into external sinks
- **Firebase Storage path traversal** — attachment/report-card upload building object paths from user input (`../`, absolute paths, null bytes). `api/attachments/upload`, `api/report-card/upload|bulk-upload`, `admin-storage.ts`, `storage.rules`.
- **Google Sheets formula/CSV injection** — data exported to CSV (`lib/csv.ts`, all `/api/export/*`) or written to Sheets: leading `=,+,-,@` cells → formula injection when opened in Excel/Sheets.
- **Tests:** upload with crafted filenames/paths; put `=HYPERLINK(...)` in a name field, export, inspect CSV escaping.
- **Bar:** Paths server-generated & validated; CSV cells prefixed/escaped per OWASP.

### 4.6 XSS (stored/reflected/DOM)
- **Where:** Any `dangerouslySetInnerHTML`, message bodies, homework text, issue text, names rendered raw, `<img src>`/`<a href>` from user data, PWA notification payloads.
- **Tests:** grep `dangerouslySetInnerHTML`; inject `<script>`/`javascript:` into message/homework/name fields and render; check notification body sanitization.
- **Bar:** React auto-escaping preserved; no unsanitized HTML sink; CSP as backstop.

### 4.7 CSRF
- **Where:** Next.js Server Actions (POST-only, origin-checked in Next 16) and custom route handlers doing mutations (`/api/report-card/*`, `/api/attachments/upload`).
- **Tests:** confirm Next 16 Server Action origin/host allowlist active; confirm mutation route handlers require the session cookie *and* validate origin or are safe by same-site cookie; check `sameSite` on auth cookie.
- **Bar:** No state-changing GET; all mutations require a validated same-site session.

### 4.8 SSRF
- **Where:** Google Sheets sync (fetches a sheet by ID/URL), any server-side fetch of a user-supplied URL, image/attachment fetching.
- **Tests:** check whether any URL fetched server-side is user-controlled; sheet ID is config not user input.
- **Bar:** No user-controlled server-side fetch to arbitrary hosts.

### 4.9 Secrets & Credential Management
- **Where:** repo root has `client_secret_*.json`, `*firebase-adminsdk*.json`, `manthan-portal-*.json`, `.env.local`. `.env.example`.
- **Tests:** confirm all are gitignored **and never committed** (`git log --all` per file); confirm no secret is under `NEXT_PUBLIC_` (would ship to browser); confirm service-role key only in server code; scan bundle for leaked keys; rotate any that ever touched git.
- **Bar:** No secret in git history, no secret in client bundle, least-privilege service accounts.

### 4.10 Rate limiting / DoS / resource abuse
- **Where:** Login, password reset, activation, message broadcast fan-out, bulk report-card upload, export endpoints, cron.
- **Tests:** check for any rate limiting (Supabase Auth has some; app endpoints likely none); check upload size limits; check broadcast/export unbounded row counts.
- **Bar:** Auth endpoints rate-limited; uploads size-capped; expensive ops bounded/authorized.

### 4.11 Cron / background-job auth
- **Where:** `/api/cron/tick` (Bearer `CRON_SECRET`).
- **Tests:** call without/with wrong header → 401; confirm `CRON_SECRET` is set (empty env ⇒ `Bearer undefined` accepted); confirm constant-time compare not strictly needed but header required.
- **Bar:** Secret required, non-empty, and job side effects are idempotent.

### 4.12 Mass assignment / over-posting
- **Where:** Server actions that spread `formData`/object into an insert/update without column allowlist (e.g., letting a user set `role`, `guardian_id`, `status`, `approved_by`).
- **Tests:** for each mutating action, confirm only intended columns are written; attempt to smuggle privileged columns.
- **Bar:** Explicit column allowlists on every write.

### 4.13 Information disclosure
- **Where:** Error messages leaking stack/SQL, `console.error` with PII, verbose 500s, `.select("*")` returning more than the UI needs, notification logs, source maps in prod.
- **Tests:** trigger errors; inspect responses; check exported columns; check that `getViewer`/queries don't over-select sensitive fields sent to client components.
- **Bar:** Generic client errors; no PII in responses beyond authorization.

### 4.14 Business-logic integrity
- **Where:** Results/marks entry, attendance, leave approval chains (`approval_steps`), stay-back consents, PTM slot booking (double-booking/race), grade boundaries, guardian receipt updates.
- **Tests:** attempt to approve out of order, book a taken PTM slot concurrently, edit finalized results, consent on another child's stay-back, set marks above max.
- **Bar:** Invariants enforced in DB (constraints/policies), not just UI.

### 4.15 Transport & headers
- **Where:** `next.config.ts`, `vercel.json` — HSTS, CSP, X-Frame-Options/frame-ancestors (clickjacking), X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Tests:** inspect configured headers; verify HTTPS enforced (Vercel default), clickjacking protection on the console.
- **Bar:** Security headers present; console not framable.

### 4.16 Dependency vulnerabilities
- **Where:** `package-lock.json`.
- **Tests:** `npm audit`, check `next@16.2.12`, `firebase-admin`, `googleapis`, `web-push`, `jszip` for advisories.
- **Bar:** No high/critical known CVEs unpatched.

### 4.17 File-upload safety
- **Where:** attachments, report cards, bulk zip (`jszip`).
- **Tests:** content-type/extension validation, size caps, zip-bomb / zip-slip on bulk upload, storage of executable content served with wrong content-type.
- **Bar:** Type/size validated; zip entries path-checked; served as attachments not inline where relevant.

### 4.18 Multi-tenancy / cross-family isolation *(app-specific crux)*
- **Where:** the guardian↔student↔class graph. Every read/write must be constrained to the viewer's own children (guardian) or assigned scope (staff).
- **Tests:** the §5 impersonation matrix, plus targeted IDOR on each guardian action.
- **Bar:** Zero cross-family leakage at the DB layer.

---

## 5. Database Security — Per-Table RLS Audit Matrix

**Method:** For each table, verify (1) RLS is enabled AND forced, (2) SELECT policy scopes rows to the caller, (3) INSERT/UPDATE/DELETE policies exist and are correctly scoped (no accidental `USING (true)` / `WITH CHECK (true)`), (4) no over-broad `GRANT` to `anon`/`authenticated` that bypasses intent, (5) `SECURITY DEFINER` helper functions used in policies are injection-safe and `search_path`-pinned.

**Impersonation test template (per policy):**
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','<auth_user_id>','role','authenticated')::text, true);
-- positive: caller's own row → expect rows
-- negative: another family's row / out-of-scope → expect 0 rows or error
<query>;
```

### 5.1 Table checklist (all 48)
Grouped by sensitivity; every one gets the matrix above.

**Identity / access-control (critical):**
`guardians`, `staff`, `guardian_student`, `students`, `class_sections`, `class_subject_teachers`, `custom_groups`, `custom_group_students`, `custom_group_staff_access`, `message_send_permissions`, `student_qr_codes`

**Academic / records (high — PII of minors):**
`attendance_records`, `exam_results`, `grade_boundaries`, `subject_grading_config`, `subjects`, `timetable_entries`, `timetable_periods`, `homework_assignments`, `homework_submissions`, `homework_comments`, `homework_notifications`, `defaulter_records`, `competitions`

**Communication / workflow (high):**
`messages`, `message_targets`, `message_receipts`, `message_attachments`, `notification_log`, `notification_preferences`, `push_subscriptions`, `reminders`, `reported_issues`, `reported_issue_recipients`, `parent_consultations`

**Meetings / consents / approvals (high):**
`ptm_meetings`, `ptm_meeting_teachers`, `ptm_slots`, `leave_requests`, `stay_back_consents`, `approval_steps`, `staff_reassignment_alerts`, `dtr_events`, `dtr_event_classes`

**Finance (high):**
`invoices`, `payments`

**Ops / sync / storage (medium):**
`sheet_sync_runs`, `sheet_sync_pending_deletions`, `storage_usage_snapshots`

**Per-table specific red flags to confirm:**
- `staff.role` — not self-updatable; role change only by super_admin.
- `guardian_student` — a guardian cannot insert a link to a student they don't own (would grant access to any child).
- `exam_results` / `attendance_records` — teachers write only for their assigned classes/subjects; guardians read-only for own children.
- `payments` / `invoices` — guardians read own; only staff/finance write; guardian cannot mark paid.
- `push_subscriptions` — a user can only register/read their own endpoints.
- `message_send_permissions` — not self-grantable.
- `stay_back_consents` / `leave_requests` — consent/approval keyed to the correct guardian/child and approver.
- `student_qr_codes` — QR value not guessable / not readable across students.
- `SECURITY DEFINER` fns (`current_staff_role`, `is_*`, integrity triggers in 0040, storage-usage in 0045) — `search_path` pinned to `public` (confirmed present in grep), no dynamic SQL from user input.

---

## 6. Code-Path Audit Checklist (every action & route)

For **each** of the 32 `actions.ts` files and 11 route handlers, confirm the full chain:

1. **Authn** — resolves `getViewer()`; rejects null.
2. **Authz** — correct role/ownership gate (`requirePrincipal`/`requireSuperAdmin`/explicit guardian-owns-child check) *before* any write.
3. **Input validation** — every field type/length/enum-checked; IDs verified to belong to caller's scope.
4. **RLS reliance** — uses anon-key client (RLS on); if it uses `createAdminClient()`, it re-implements the authorization the DB would have done.
5. **Column allowlist** — no mass assignment.
6. **Output** — returns only what the caller may see; no leaked columns/errors.
7. **Side effects** — external calls (push/sheets/storage) can't be weaponized (SSRF, injection, fan-out to wrong recipients).

**Priority order:** the 13 `createAdminClient()` sites first (RLS bypass), then guardian-facing actions (A2/A3), then principal-only actions (A4), then route handlers.

---

## 7. Secrets, Config & Infra Checklist
- [ ] All credential files gitignored **and** absent from full git history (`git log --all -- <file>`).
- [ ] No secret prefixed `NEXT_PUBLIC_` except the intended anon key + public config.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never imported in a client component / never in the browser bundle.
- [ ] Firebase admin key & Google service-account key least-privilege; rotate if ever committed.
- [ ] `CRON_SECRET`, `VAPID` keys present, strong, non-empty.
- [ ] `storage.rules` deny-by-default; only authorized paths writable.
- [ ] `next.config.ts` sets security headers; source maps not exposing secrets.
- [ ] `Dockerfile` doesn't bake secrets into layers; `.dockerignore` excludes env/keys.
- [ ] `vercel.json` cron config matches the protected route.

---

## 8. Test Suite / Verification Plan
- **Static:** `npx tsc --noEmit`, `npx eslint src` (baseline lint noise noted in project memory).
- **RLS:** the §5 impersonation matrix, scripted per table, positive + negative.
- **IDOR/E2E:** Playwright specs under `e2e/` extended with cross-tenant attempts (guardian A fetching guardian B's child).
- **Dependency:** `npm audit --production`.
- **Secrets:** git-history scan + bundle grep for key patterns.
- **Manual:** curl each route handler unauthenticated and with wrong role.
- **Re-verification:** this document + the impersonation scripts are the regression gate for future changes.

## 9. Severity Scale
- **Critical** — cross-tenant data read/write, privilege escalation to super_admin, RCE, secret exposure enabling above.
- **High** — access beyond role scope, PII disclosure, auth bypass on a single feature.
- **Medium** — CSRF/XSS requiring interaction, missing rate limit, info leak.
- **Low** — hardening gaps (headers, verbose errors) with no direct exploit.
- **Info** — defense-in-depth suggestions.

---

## 10. Findings Tracker

**Audit executed 2026-09-03.** Method: static review of all route handlers, all 13 service-role call sites, and the auth layer; live-DB policy inspection + rolled-back impersonation tests (Supabase project `symyylbkadpzzyncwjbd`); secrets/git-history scan; `npm audit`; header/config review. Impersonation used `set local role authenticated` + JWT-claims `set_config` so RLS actually applies (service-role otherwise bypasses it).

### What's solid (verified, no action needed)
- **No secrets in git history** — every credential file (`*firebase-adminsdk*.json`, `client_secret_*.json`, `manthan-portal-*.json`, `.env*`) is gitignored and `git log --all` shows none were ever committed.
- **No server secret shipped to the browser** — only the anon key, Supabase URL, Firebase web config, and VAPID *public* key carry `NEXT_PUBLIC_`; service-role/admin/Sheets/SMS/VAPID-private/CRON secrets are all server-only.
- **Cross-family isolation holds at the DB layer** — every guardian read/write policy (results/attendance read, leave, stay-back, consultations, homework, timetable, messages, PTM booking, approvals, defaulters, QR) is scoped via `guardian_student … = current_guardian_id()`. Guardians cannot self-link students (`guardian_student` writes are principal-only), cannot spoof `sender_id` on messages, and can only cancel (not arbitrarily edit) their own consultations. Stay-back/leave inserts are `WITH CHECK`-bound to own children even though the app code doesn't re-check.
- **No injection sinks** — no `eval`/`new Function`/`child_process`, no raw/interpolated SQL, and the one `dangerouslySetInnerHTML` (`qr-manager.tsx`) renders a library-generated SVG from a random token, not user markup.
- **Sensitive staff actions gated** — sheet-sync row deletion is `requireSuperAdmin()` + a table allowlist; message-send scope for class teachers is enforced (`requireSendPermission` + `requireTeacherScope`).

### Findings

**Remediation applied 2026-09-03** — migration `supabase/migrations/0050_security_hardening.sql` (applied to project `symyylbkadpzzyncwjbd`) + the code changes below. DB fixes re-verified by impersonation (principal can't mint/modify super_admin; teacher can't edit an out-of-scope student's marks; principal still can).

| # | Sev | Title | Fix | Status |
|---|-----|-------|-----|--------|
| F1 | **High** | Full `staff` directory (phone/email/**username**) readable by all parents | Base table restricted to `is_staff()`; guardians now read a `staff_directory` view (id/name/role/active only). 4 parent pages repointed | ✅ Fixed |
| F2 | **High** | coordinator/principal could create/self-promote to `super_admin` | Split `staff` policy: only `super_admin` may touch super_admin rows or grant the role. App guards `createStaffAccount`/`updateStaffRole`/`setStaffActive` with `requireSuperAdmin` | ✅ Fixed |
| F3 | **Medium** | Any staff could write any student's marks via direct API | `exam_results` writes scoped to principal-tier or the student's own teacher (`staff_can_edit_student_marks()`). Attendance/homework left all-staff **by design** (front office marks school-wide) — documented | ✅ Fixed (marks) / documented |
| F4 | **Medium** | `push_subscriptions` RLS-enabled-no-policy; delete had no owner check | Owner-scoped policy added; `deletePushSubscription` now requires a session | ✅ Fixed |
| F5 | **Medium** | Activation takeover — email-only, no ownership proof | Activation now requires the **on-file mobile number** to match (proof-of-ownership second factor) + password ≥8 | ⚠️ Mitigated (see note) |
| F6 | **Medium** | CSV/formula injection in exports | `toCsv()` prefixes cells starting `= + - @ \t \r` with `'` | ✅ Fixed |
| F7 | **Medium** | Attachment write-IDOR + unsanitized storage path | Uploader must own the message; `messageId` UUID-validated; filename sanitized to a basename | ✅ Fixed |
| F8 | **Medium** | No security headers | `next.config.ts` sets X-Frame-Options DENY, CSP `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy | ✅ Fixed |
| F9 | **Medium** | Dependency advisories (uuid via firebase-admin) | `npm audit fix` (11→8). Residual 8 need a **breaking** `firebase-admin` major bump — not pushed blind | ⚠️ Partial (see note) |
| F10 | **Low** | Cron fails open if `CRON_SECRET` unset | Route now refuses to run when the secret is unset/empty | ✅ Fixed |
| F11 | **Low** | Weak password floor + HIBP off | Min length raised to 8 (activation + staff). **HIBP toggle is a Supabase dashboard setting** — action item | ⚠️ Partial (see note) |
| F12 | **Low** | Helper funcs `EXECUTE`-able by `anon` via `/rpc` | `EXECUTE` revoked from `anon` on the helper/definer functions | ✅ Fixed |
| F13 | **Low** | Mutable `search_path` on 4 invoker functions | `search_path` pinned to `public` on all four | ✅ Fixed |
| F14 | Info | `payments`/`invoices` deny-all, no read path | Safe as-is; documented for when a parent-facing view is built | ▫️ Noted |
| F15 | Info | Dual-role (guardian+staff) auth ids get staff DB read | Expected for staff-who-parent; documented | ▫️ Noted |
| F16 | Info | Redundant `staff` SELECT policies | Removed as part of F1 | ✅ Fixed |

### Action items that can't ship in code (owner must do in the Supabase dashboard)
- **F11** — enable **Leaked Password Protection** (Auth → Policies → "Check against HaveIBeenPwned"). One toggle.
- **F9** — schedule a tested `firebase-admin` major upgrade to clear the residual `uuid` advisories (breaking; verify Storage upload + push still work).
- **F5** — the phone-match is a meaningful barrier but not full email-ownership verification. For a bank-grade fix, move activation to an emailed magic-link/OTP once an email transport is chosen. The current change is safe and won't lock out parents who know their own number.

*Sections 4–7 are the checklist the audit walked. Re-run the §5 impersonation queries after any RLS change to keep the posture verified.*
