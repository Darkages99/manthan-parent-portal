# 00 — Glossary & Conventions

This document defines every domain term, role, and abbreviation used across the
compliance set, plus the notation conventions the other documents follow.

---

## 1. Notation conventions

- **`path/to/file.ts:123`** — a clickable reference to a specific line in the
  repository. When a range matters it is written `file.ts:10-40`.
- **RLS** policies are quoted by their policy name in double quotes, exactly as
  they appear in the migration, e.g. `"guardian reads linked students"`.
- **Requirement IDs** use the form `FR-<MODULE>-<n>` (functional),
  `NFR-<n>` (non-functional), `SEC-<n>` (security control), `DG-<n>` (data
  governance). These IDs are the join key for the traceability matrix (doc 11).
- **"Actor"** always means one of the defined user types in §3, never a physical
  person.
- Money is stored in **paise** (1 rupee = 100 paise) as `bigint` to avoid
  floating-point rounding — see `invoices.amount_paise`.
- Timestamps are stored as `timestamptz` (UTC); display is localized to
  **Asia/Kolkata (IST)** in the UI and in the Google Sheet mirror.

---

## 2. Core domain terms

| Term | Definition |
|------|------------|
| **Guardian** | A parent or guardian account. The primary "parent-side" actor. Linked to one or more students via `guardian_student`. Stored in `guardians`. |
| **Student** | A child enrolled at the school. Stored in `students`. Belongs to exactly one class section. Has one or more guardians. |
| **Staff** | Any school employee account (teacher, front office, accounts, coordinator, principal, super admin). Stored in `staff`. |
| **Class section** | A specific class-and-division for an academic year, e.g. "2026-27 / Grade 5 / A". Stored in `class_sections`. |
| **Viewer** | The resolved identity of the currently signed-in user — either a `GuardianViewer` or a `StaffViewer`, or `null` if unauthenticated. Produced by `getViewer()` (`src/lib/session.ts`). |
| **Console** | The staff-facing area of the app, under the `/console` route group. |
| **Portal** | The parent-facing area of the app (the default route group). |
| **DTR** | "Dates To Remember" — the school calendar (exams, holidays, events, deadlines, PTMs). Stored in `dtr_events`. |
| **PTM** | Parent-Teacher Meeting. A `ptm_meeting` groups bookable `ptm_slots`. |
| **Stay-back consent** | A parent request to keep their child at school past normal hours, requiring a multi-step staff approval chain. `stay_back_consents`. |
| **Consultation** | An off-cycle parent-requested meeting (Tuesdays/Thursdays only), distinct from a PTM. `parent_consultations`. |
| **Defaulter record** | A recorded disciplinary/behavioural incident for a student. `defaulter_records`. |
| **Approval chain / step** | A generic ordered list of role-based approvals attached to a subject (a stay-back or a PTM booking). `approval_steps`. |
| **Custom group** | A staff-defined ad-hoc set of students used as a messaging target. `custom_groups`. |
| **Receipt / report card** | PDF documents held in Firebase Storage, referenced by URL columns in `payments` / `exam_results`. |
| **Roster** | The set of people/classes/subjects/timetable managed from the Google Sheet and synced into the database. |
| **Sheet sync** | The scheduled job that reconciles the Google Sheet into Postgres. `src/lib/google-sheets.ts`. |
| **Pending deletion** | A row that vanished from the Google Sheet; queued for a super-admin to confirm rather than auto-deleted. `sheet_sync_pending_deletions`. |

---

## 3. Actor / role catalogue

The `role` enum (`supabase/migrations/0001_init.sql:12`, extended in `0009` and
`0030`) has these values. "Principal-tier" is a recurring grouping defined in
`src/lib/roles.ts:10`.

| Role value | Human label | Tier | What they can do (summary) |
|------------|-------------|------|-----------------------------|
| `parent` | Parent / Guardian | Guardian | See and act only on their own children's data. Not a staff role. |
| `class_teacher` | Teacher | Staff (scoped) | Mark attendance, enter marks for their own classes/subjects, author homework, message their scoped audience, act as a named approver. |
| `front_office` | Front Office | Staff | School-wide operational tasks: attendance, triage issues shared with them, approval steps. |
| `accounts` | Accounts | Staff | Finance-oriented staff role (payments/invoices are staff-writable). |
| `coordinator` | Coordinator | **Principal-tier** | Admin-equivalent to principal for gating purposes (`src/lib/roles.ts:10`). |
| `principal` | Principal | **Principal-tier** | Full school-wide management: classes, timetable, results scope, approvals, message permissions. |
| `super_admin` | Super Admin | **Principal-tier + strict** | Everything principal can do, **plus** the strict-only actions: create/elevate other super admins, confirm sheet-sync deletions. |

> Note: an `admin` role label appears in some legacy RLS branches (e.g.
> `0039_issue_audience.sql:743`) as the historical name for front office. New
> code uses `front_office`.

**Dual-role people:** a staff member who is also a parent has two logical
identities. `getViewer()` resolves a guardian identity first if one exists for
their auth user, otherwise a staff identity (`src/lib/session.ts:31-60`). This is
intentional and documented as an accepted item (F15) in `SECURITY_AUDIT.md`.

---

## 4. Technology abbreviations

| Term | Meaning |
|------|---------|
| **RLS** | Row-Level Security — PostgreSQL feature that filters rows per policy based on the current database role/JWT. The authoritative access-control layer here. |
| **SSR** | Server-Side Rendering — pages/components run on the server; the Supabase session travels in httpOnly cookies. |
| **Server Action** | A Next.js server-side function (`"use server"`) invoked from the client as a POST; used for all mutations. Origin-checked by Next 16. |
| **Route handler** | A Next.js HTTP endpoint under `src/app/api/**/route.ts`. Used for uploads, CSV exports, and the cron tick. |
| **Anon key** | The Supabase publishable key used by the SSR client; all queries under it pass through RLS. |
| **Service-role key** | The Supabase secret key used by the admin client; **bypasses RLS**. Server-only, used only for trusted background work. |
| **VAPID** | The key pair that authenticates Web Push messages. Public key ships to the browser; private key is server-only. |
| **FCM** | Firebase Cloud Messaging (relevant to Web Push delivery on some browsers). |
| **PWA** | Progressive Web App — installable, works from a home-screen icon; required for iOS push. |
| **IST** | India Standard Time (Asia/Kolkata), the school's local time zone. |
| **PII** | Personally Identifiable Information — here, largely the data of minors and their guardians. |
| **DPDP** | India's Digital Personal Data Protection Act, 2023 — the relevant privacy regime (see doc 09). |

---

## 5. Environment / deployment terms

| Term | Meaning |
|------|---------|
| **Vercel** | The hosting platform; also runs the scheduled cron (`vercel.json`). |
| **Supabase project** | The managed Postgres + Auth instance (project ref `symyylbkadpzzyncwjbd`, per `SECURITY_AUDIT.md`). |
| **Cron tick** | The daily `GET /api/cron/tick` invocation that runs sheet sync + homework notifications. Region `bom1` (Mumbai), `0 3 * * *` (03:00 UTC ≈ 08:30 IST). |
| **Standalone output** | Next.js `output: "standalone"` build mode producing a self-contained server bundle for Docker (`next.config.ts:19`). |
