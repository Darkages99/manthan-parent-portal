# 05 — Security & Access Control

This document specifies how the system authenticates users, authorizes actions,
enforces per-family and per-role data isolation, manages secrets, and defends each
trust boundary. It summarizes and cross-references the full audit in the
repository-root **`SECURITY_AUDIT.md`**, which remains the authoritative,
living security record (threat model, per-table RLS matrix, findings tracker). This
document is the compliance-facing narrative; that file is the working audit.

---

## 1. Security model in one paragraph

Access control is **defense in depth with PostgreSQL Row-Level Security (RLS) as
the authoritative layer.** Three weaker layers precede it (route-group layout
redirects, server-action role gates, ownership checks in code), but the guarantee
is that *even if all of those were bypassed, RLS on every table still restricts a
parent to rows connected to their own children and staff to their role's scope.*
The only code that can escape RLS is the server-only service-role client, used at a
small, enumerated set of sites, each of which re-implements the authorization the
database would otherwise have applied.

---

## 2. Authentication (`SEC-AUTH`)

| Control | Implementation |
|---------|----------------|
| **SEC-AUTH-1** Identity provider | Supabase Auth. Entry paths: email/password, phone OTP, Google OAuth. |
| **SEC-AUTH-2** Server-side JWT validation | `getViewer()` uses `auth.getUser()` (validates the token against Supabase), **not** `getSession()` (which would trust the cookie blindly). `src/lib/session.ts:26`. |
| **SEC-AUTH-3** Session transport | httpOnly cookies via `@supabase/ssr`; refreshed by `proxy.ts` on matched routes. Cookies are not readable by JS (XSS can't steal them directly). |
| **SEC-AUTH-4** Deactivation | Staff with `active=false` resolve to no viewer (`session.ts:57`); guardian access is revoked by removing their links. No privilege survives deactivation. |
| **SEC-AUTH-5** Activation ownership | `/activate` requires the on-file mobile number to match + password ≥8 (finding F5, mitigated). |
| **SEC-AUTH-6** Request caching | `getViewer()` is wrapped in React `cache()` so one request shares a single validated lookup (no repeated trust decisions). |

---

## 3. Authorization layers (`SEC-AUTHZ`)

| Layer | Control | Where |
|-------|---------|-------|
| Coarse | Route-group layout redirects wrong actor type | `(parent)/layout.tsx`, `(staff)/layout.tsx` |
| Role gate | `requirePrincipal()` (principal/super_admin/coordinator), `requireSuperAdmin()` (strict) | `src/lib/roles.ts` |
| Ownership | Explicit "guardian owns this child" checks + RLS `WITH CHECK` | per action + policies |
| **Authoritative** | **RLS on every table** | all migrations |

`PRINCIPAL_ROLES = [principal, super_admin, coordinator]` (`roles.ts:10`).
`requireSuperAdmin()` is reserved for the one truly destructive path (confirming
sheet-sync deletions) and super-admin/role management.

---

## 4. Row-Level Security (the core, `SEC-RLS`)

RLS is enabled on **every** table. The policies fall into recurring idioms:

### 4.1 Guardian scoping idiom
Every guardian-readable table filters through the ownership graph:
```sql
student_id in (
  select student_id from guardian_student
  where guardian_id = current_guardian_id()
)
```
or, for class-scoped data (timetable, homework, PTM meetings), through the child's
`class_section_id`. A guardian query for "everything" returns only their own
family's slice — enforced by the database, not the UI.

### 4.2 Guardian write binding (`WITH CHECK`)
Guardian inserts are bound so a parent cannot forge ownership even by calling the
action directly with another child's id:
- `leave_requests`: `requested_by = current_guardian_id()` AND own child.
- `stay_back_consents`: `raised_by_guardian_id = current_guardian_id()` AND own child.
- `parent_consultations`: `requested_by = current_guardian_id()` AND own child;
  update allowed **only** to `status='cancelled'`.
- `reported_issues`: `reported_by_guardian_id = current_guardian_id()`.

### 4.3 The single most important control
**A guardian cannot write `guardian_student`.** Link creation is staff-only. If a
parent could insert a link, they could grant themselves any child. This is closed
at the DB layer and verified by impersonation (`SECURITY_AUDIT.md` §10 "What's
solid").

### 4.4 Staff scoping
- Reads: `is_staff()` grants read on operational tables.
- Marks writes: `staff_can_edit_student_marks()` limits to principal-tier or the
  student's own teacher (0050).
- Config writes (subjects, periods, timetable, competitions, permissions,
  class-subject-teachers): `current_staff_role() in (principal, super_admin[, coordinator])`.
- Staff management: super_admin manages all incl. super_admin;
  principal/coordinator manage non-super_admin only (0050).

### 4.5 SECURITY DEFINER helper safety
The helper functions that resolve identity/role (`current_guardian_id`,
`current_staff_role`, `is_staff`, `is_principal`, `staff_can_edit_student_marks`,
`current_staff_is_issue_recipient`) are `SECURITY DEFINER` with `search_path`
pinned to `public` (finding F13), and `EXECUTE` is revoked from `anon` (F12). They
contain no dynamic SQL built from user input.

---

## 5. Per-domain access summary

| Domain | Guardian | class_teacher | front_office | coordinator | principal | super_admin |
|--------|----------|---------------|--------------|-------------|-----------|-------------|
| Own child records (read) | ✅ own | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all |
| Attendance (write) | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Marks (write) | — | ✅ own classes | — | ✅ | ✅ | ✅ |
| Timetable/subjects/periods (write) | — | — | — | — | ✅ | ✅ |
| Approve leave/stay-back/PTM | — | ✅ named step | ✅ step | ✅ step | ✅ step | ✅ |
| Message school-wide | — | ❌ | per grid | ✅ | ✅ | ✅ |
| Manage staff (non-super) | — | — | — | ✅ | ✅ | ✅ |
| Manage super_admins | — | — | — | — | — | ✅ |
| Confirm sheet deletions | — | — | — | — | — | ✅ |
| Read notification log | — | — | — | ✅ | ✅ | ✅ |

(“✅ step” = may act on an approval step assigned to their role/name.)

---

## 6. The service-role (RLS-bypass) surface — highest risk

The service-role client bypasses RLS, so each site must re-authorize. The
enumerated non-factory sites and why each is safe:

| Site | Why it needs bypass | Re-authorization |
|------|---------------------|------------------|
| `stay-back/actions.ts` | Only staff may write `approval_steps`; a guardian action must create the chain after their own scoped insert | Preceded by guardian `getViewer()` + RLS-bound consent insert |
| `ptm/actions.ts` (book) | Same as above for `ptm_slot_request` chain | Same pattern |
| `report-issue/actions.ts` | Attach recipients / cross-cutting insert | Reporter identity checked; RLS insert bound to self |
| `messages/compose/actions.ts` | Resolve broadcast recipients across families, insert receipts, fan out push | Sender staff + send-permission + teacher-scope checks first |
| `staff/actions.ts` | Create/modify staff accounts | `requireSuperAdmin()` for role-sensitive ops; DB policy split also enforces |
| `sync/pending-deletions/actions.ts` | Delete confirmed rows | `requireSuperAdmin()` + table allowlist |
| `activate/actions.ts` | Complete auth linkage before a session exists | Phone-match proof-of-ownership |
| `api/attachments/upload/route.ts` | Write attachment + storage | Uploader must own the message; UUID-validated; filename sanitized |
| `api/report-card/upload` + `bulk-upload` | Write files + result rows | Session + staff validated; zip entries path-checked |
| `lib/google-sheets.ts` | Trusted background roster sync | Runs from cron (CRON_SECRET) or staff console; deletions queued not applied |
| `lib/homework-notify.ts` | Background sweep across classes | Read-only + push; no user input |
| `lib/notifications/push.ts` | Read subscriptions across users to fan out | Targets computed by the calling feature's authorized logic |
| `lib/reference-data.ts` | Server-side reference lookups | Read-only reference data |

---

## 7. Input handling & injection defenses (`SEC-INJ`)

| Class | Status | Control |
|-------|--------|---------|
| SQL injection | No sink | Supabase query builder is parameterized; no raw/interpolated SQL; SECURITY DEFINER bodies use no user-built `EXECUTE`. |
| XSS | No unsanitized sink | React auto-escaping preserved; the only `dangerouslySetInnerHTML` (`qr-manager.tsx`) renders a library-generated SVG from a random token, not user markup; CSP `frame-ancestors 'none'` as backstop. |
| CSV / formula injection | Fixed (F6) | `toCsv()` prefixes cells starting `= + - @ \t \r` with `'` (`src/lib/csv.ts`). |
| Storage path traversal | Fixed (F7) | Paths server-generated; `messageId` UUID-validated; filename reduced to a basename. |
| Zip-slip (bulk report cards) | Guarded | Zip entry paths validated on `bulk-upload`. |
| SSRF | No user-controlled fetch | The only server-side external fetches (Sheets, SMS relay) use config, not user-supplied URLs. |
| Mass assignment | Explicit fields | Actions read named `formData` fields and write explicit columns; privileged columns (`role`, ownership ids, `status`) are not user-settable. |

---

## 8. Transport & headers (`SEC-HDR`)

Set for every route in `next.config.ts:7-14`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — HTTPS pinned.
- `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'` — clickjacking blocked (console is never framable).
- `X-Content-Type-Options: nosniff` — no MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.

CSRF: Next 16 server actions are POST-only with an origin/host allowlist; mutation
route handlers require the same-site session cookie.

---

## 9. Secrets management (`SEC-SECRET`)

| Control | Status |
|---------|--------|
| All credential files gitignored and **never committed** (verified via `git log --all`) | ✅ (`SECURITY_AUDIT.md`) |
| No server secret under `NEXT_PUBLIC_` — only anon key, Supabase URL, Firebase web config, VAPID **public** key are public | ✅ |
| Service-role key server-only (`admin.ts` is `server-only`) | ✅ |
| Firebase Admin key, Google service-account key, VAPID private key, `CRON_SECRET`, SMS token — server env only | ✅ |
| Storage rules deny all direct client access | ✅ (`storage.rules`) |
| Docker excludes env/keys | ✅ (`.dockerignore`) |

Credential files present in the working tree (gitignored) include the Firebase
Admin SDK JSON, the Google OAuth client secret JSON, and `.env.local`. See doc 10
for the full env matrix.

---

## 10. Cron & background-job auth (`SEC-CRON`)
`GET /api/cron/tick` requires `Authorization: Bearer <CRON_SECRET>` and **fails
closed** when the secret is unset/empty (finding F10, `route.ts:15-22`). Jobs are
idempotent and safe to re-run.

---

## 11. Data-integrity controls (`SEC-INTEG`)
Deferred constraint triggers (checked at COMMIT) enforce:
- a student always has ≥1 guardian;
- a guardian always has a linked child **or** an email.
Multi-row link changes go through SECURITY INVOKER RPCs so a whole operation is one
transaction (`0040_integrity_rules.sql`). See doc 03 §7–8.

---

## 12. Known residual items (owner action required)

From `SECURITY_AUDIT.md` §"Action items that can't ship in code":
- **F11** — enable Supabase "Leaked Password Protection" (HIBP) in the dashboard.
- **F9** — schedule a tested `firebase-admin` major upgrade to clear residual
  `uuid` transitive advisories (breaking; verify Storage + push after).
- **F5** — consider upgrading activation to emailed magic-link/OTP for full
  email-ownership verification.

These are tracked as open in the audit; they are configuration/roadmap items, not
code defects.

---

## 13. Attacker-profile coverage (summary)

The audit's threat model (A1–A8) is fully enumerated in `SECURITY_AUDIT.md` §3.
Compliance-level summary of the outcome:

| Attacker | Outcome |
|----------|---------|
| Unauthenticated | No route reaches data without a validated session; cron/uploads gated. |
| Authenticated guardian (IDOR) | Cross-family reads/writes blocked at RLS; cannot self-link children. |
| Malicious guardian (forged requests) | `WITH CHECK` binds inserts to own children even bypassing the UI. |
| Low-privilege staff | Marks scoped; can't escalate to principal/super_admin; can't send school-wide. |
| Compromised channel (push/sheet/cron) | Cron secret required; sheet deletions queued; push private key server-only. |
| Supply chain | `npm audit` run; residual advisories tracked (F9). |
| Insider w/ repo | No secrets in history. |
| Network/browser | HTTPS pinned, clickjacking blocked, httpOnly cookies, origin-checked actions. |
