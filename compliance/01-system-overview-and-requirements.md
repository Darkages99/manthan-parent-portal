# 01 — System Overview & Requirements (SRS)

This document is the Software Requirements Specification: the purpose, scope,
stakeholders, actors, and the enumerated functional and non-functional
requirements the system exists to satisfy. Requirement IDs defined here are
referenced by the functional-module document (06) and the traceability matrix (11).

---

## 1. Purpose & scope

### 1.1 Problem statement
A single school (Manthan Vidyashram) needs a low-cost, transparent channel between
parents and staff for day-to-day school life: attendance, academics, homework,
fees, calendar, and a set of parent-initiated requests and staff approvals. The
system replaces ad-hoc phone/WhatsApp/paper communication with an auditable,
role-scoped application.

### 1.2 In scope
- A parent-facing progressive web app (the **Portal**).
- A staff-facing management console (the **Console**).
- A relational data store with strict per-family / per-role access control.
- Roster & academic configuration managed from a Google Sheet.
- File storage for report cards, receipts, and message attachments.
- Multi-channel, best-effort notifications (Web Push, SMS relay, WhatsApp link).

### 1.3 Out of scope (by design, as of this baseline)
- **Online fee payment / payment gateway.** `invoices`/`payments` tables exist and
  are readable-by-design-only; there is no parent-facing payment execution flow
  (see `SECURITY_AUDIT.md` F14). Payments are recorded by staff.
- **In-app competition registration** — the competitions module is informational
  only (`0021_competitions.sql`).
- **Automated WhatsApp/SMS broadcast** — WhatsApp is click-to-chat (human presses
  send); SMS depends on an Android relay phone being provisioned.
- **Native mobile apps** — delivery is a PWA.

### 1.4 Stakeholders
| Stakeholder | Interest |
|-------------|----------|
| Parents / guardians | Visibility into their child; ability to raise requests. |
| Teachers | Efficient attendance/marks/homework entry; scoped communication. |
| Front office | School-wide operations and triage. |
| Coordinator / Principal | Oversight, configuration, approvals. |
| Super admin | System administration, destructive-action authority. |
| Data-protection reviewer | Assurance that minors' data is scoped and governed. |
| Engineering | Maintainability and a verifiable security posture. |

---

## 2. Actors

See the role catalogue in `00-glossary-and-conventions.md` §3. In requirement
terms there are two top-level actor classes and one non-human actor:

- **Guardian** (`parent`) — parent-side.
- **Staff** — with sub-roles `class_teacher`, `front_office`, `accounts`,
  `coordinator`, `principal`, `super_admin`.
- **System / scheduler** — Vercel Cron and the sheet-sync/notification background
  jobs, which act under the service-role client.

---

## 3. Functional requirements

Grouped by module. Each is implemented and verified as traced in doc 11. The
module document (06) gives the detailed rules and the exact source/RLS artifacts.

### 3.1 Identity & access (`FR-AUTH-*`)
- **FR-AUTH-1** Users authenticate via Supabase Auth: email/password, phone OTP,
  and Google OAuth are supported entry paths.
- **FR-AUTH-2** A signed-in user is resolved to exactly one domain identity
  (guardian or active staff); an unlinked or deactivated account has no access.
- **FR-AUTH-3** New accounts are activated through a proof-of-ownership flow that
  requires the on-file mobile number to match (`/activate`).
- **FR-AUTH-4** A guardian may only ever read/write data connected to their own
  children; this is enforced at the database layer, not merely the UI.
- **FR-AUTH-5** Staff actions are gated to the minimum role tier required;
  destructive/administrative actions require principal-tier or super-admin.

### 3.2 Attendance (`FR-ATT-*`)
- **FR-ATT-1** Staff mark daily attendance per student (present/absent/late/excused,
  with half-day support).
- **FR-ATT-2** Parents view their child's attendance history and a summary/donut,
  with a "not marked" state distinguished from "present".
- **FR-ATT-3** The console surfaces a "mark attendance for today" prompt and a
  defaulters/absent-today view.

### 3.3 Academics — results & report cards (`FR-RES-*`)
- **FR-RES-1** A teacher enters marks only for students in classes/subjects they
  teach; principal-tier may enter for any.
- **FR-RES-2** Per subject+term, a grade scale (max marks + percentage→letter
  bands) can be configured; grades auto-fill from marks.
- **FR-RES-3** Report-card PDFs can be uploaded (single and bulk) and are shown to
  the relevant guardians.
- **FR-RES-4** Parents view their child's results and report card; they cannot edit.
- **FR-RES-5** Results analytics (distribution, failures per subject) are available
  to staff.

### 3.4 Homework (`FR-HW-*`)
- **FR-HW-1** Staff author, edit and delete homework for a class (title, subject,
  description, due date).
- **FR-HW-2** Staff mark per-student non-submission and can add a per-student
  comment/remark.
- **FR-HW-3** Parents view their child's class homework and any teacher comment.
- **FR-HW-4** Guardians of students with unsubmitted homework are notified once per
  assignment (dedup ledger), dispatched by the daily cron.

### 3.5 Timetable (`FR-TT-*`)
- **FR-TT-1** Principal-tier configures the daily period structure and the weekly
  timetable grid (per class/day/period → subject + teacher).
- **FR-TT-2** Parents view their child's class timetable.
- **FR-TT-3** "Who teaches what" is tracked independently of the grid
  (`class_subject_teachers`) and feeds teacher pickers and marks scope.

### 3.6 Leave (`FR-LV-*`)
- **FR-LV-1** A guardian raises a leave request for their own child (date range +
  reason).
- **FR-LV-2** Staff approve/decline; the decision and decider are recorded.
- **FR-LV-3** Parents track status; staff see an ordered pending queue.

### 3.7 Stay-back consent (`FR-SB-*`)
- **FR-SB-1** A guardian raises a stay-back consent naming a teacher, reason, date,
  time window, and how the child gets home.
- **FR-SB-2** A grade-conditional multi-step approval chain is created (named
  teacher → front office → [coordinator if below Grade 8] → principal).
- **FR-SB-3** Any decline closes the request; all steps approving marks it approved.
- **FR-SB-4** The named teacher and principals are notified immediately; others
  pick it up from the console queue.

### 3.8 Parent-teacher meetings (`FR-PTM-*`)
- **FR-PTM-1** Staff create a PTM meeting (class, teacher(s), date), then open/close
  bookable slots.
- **FR-PTM-2** A parent books/cancels a slot for their child; a booking triggers an
  approval chain (principal + named teacher).
- **FR-PTM-3** A meeting cannot be deleted while any slot is booked/pending.

### 3.9 Consultations (`FR-CON-*`)
- **FR-CON-1** A guardian requests an off-cycle consultation on a Tuesday/Thursday
  with a free-text availability note (DB-enforced day-of-week constraint).
- **FR-CON-2** Front office/principal schedule a time, decline, and record a note;
  the guardian may cancel their own.

### 3.10 Messaging (`FR-MSG-*`)
- **FR-MSG-1** Staff compose messages targeted at school / class / student / custom
  group, subject to per-role send permissions.
- **FR-MSG-2** Teachers are scoped to their own taught classes/students/groups and
  cannot send school-wide; principal-tier manages the permission grid and group
  access grants.
- **FR-MSG-3** Parents read messages addressed to them, with unread badge and read
  receipts; attachments are viewable.
- **FR-MSG-4** Bulk recipient import via CSV is supported for composition.

### 3.11 Report an issue (`FR-ISS-*`)
- **FR-ISS-1** A guardian or staff member raises an issue with an audience
  (principal-only, or front-office+principal) and optional directed teacher(s).
- **FR-ISS-2** Visibility follows the audience/direction rules exactly; a directed
  report reaches the named teacher(s) + front office + principal.
- **FR-ISS-3** Staff who can see an issue may resolve it.

### 3.12 Calendar / DTR, competitions, defaulters, gallery, QR (`FR-MISC-*`)
- **FR-MISC-1 (DTR)** Staff maintain the school calendar (per-class or whole-school);
  all authenticated users read it.
- **FR-MISC-2 (Competitions)** Principal-tier maintains an informational list; all
  read.
- **FR-MISC-3 (Defaulters)** Staff record behavioural incidents; parents read their
  own child's.
- **FR-MISC-4 (QR)** Principal-tier issues/rotates one opaque QR token per student;
  all staff read (for scanning), guardians read their own child's.
- **FR-MISC-5 (Gallery)** Staff upload event media; parents view.

### 3.13 Notifications & preferences (`FR-NOTIF-*`)
- **FR-NOTIF-1** Web Push is delivered to opted-in devices; each push attempt is
  logged durably (proof-of-notification).
- **FR-NOTIF-2** Users can opt out per category; absence of a preference row means
  enabled.
- **FR-NOTIF-3** SMS (via relay) and WhatsApp (click-to-chat) are fallbacks for
  high-urgency 1:1 cases.

### 3.14 Roster & academic-config sync (`FR-SYNC-*`)
- **FR-SYNC-1** Students, guardians, staff, class sections, subjects and timetable
  are managed from a Google Sheet and synced into Postgres daily and on demand.
- **FR-SYNC-2** Additions/amendments apply automatically; a row missing from the
  sheet is queued as a pending deletion, never auto-deleted.
- **FR-SYNC-3** Only a super admin may confirm a pending deletion.
- **FR-SYNC-4** Every sync run is recorded (start/finish/status/error).

### 3.15 Administration (`FR-ADMIN-*`)
- **FR-ADMIN-1** Super admin manages staff accounts and roles; principal/coordinator
  may manage non-super-admin staff only.
- **FR-ADMIN-2** Principal-tier can view a storage-usage snapshot (DB + files).
- **FR-ADMIN-3** Principal-tier can view the notification log (audit).

---

## 4. Non-functional requirements

| ID | Requirement | Where addressed |
|----|-------------|-----------------|
| NFR-1 | **Confidentiality / least privilege** — no cross-family or cross-role data leakage; enforced at the DB layer. | Doc 05; RLS in all migrations; `SECURITY_AUDIT.md`. |
| NFR-2 | **Auditability** — the school can prove a parent was notified of X at time Y; destructive data loss requires explicit confirmation. | `notification_log` (0042); `sheet_sync_pending_deletions` (0017). |
| NFR-3 | **Data integrity** — a student always has ≥1 parent; a guardian always has a child or an email. | Deferred constraint triggers (0040). |
| NFR-4 | **Availability / low cost** — runs on managed platforms (Vercel + Supabase + Firebase) sized for a single school; notification channels avoid per-message fees. | Doc 07; `sms.ts`, `whatsapp.ts`. |
| NFR-5 | **Portability** — deployable as a self-contained container. | `next.config.ts` standalone; `Dockerfile`. |
| NFR-6 | **Security headers / transport** — HTTPS enforced, clickjacking blocked, MIME-sniffing off. | `next.config.ts:7-14`. |
| NFR-7 | **Maintainability / typed contract** — end-to-end TypeScript, generated DB types. | `src/lib/supabase/database.types.ts`. |
| NFR-8 | **Verifiability** — a repeatable RLS/impersonation and E2E test method exists. | Doc 08; `SECURITY_AUDIT.md` §5, §8; `e2e/`. |
| NFR-9 | **Localization of time** — all user-facing times in IST. | IST formatting in sync/log code. |
| NFR-10 | **Graceful degradation** — missing optional integrations (push/SMS/sheets) no-op with a log rather than crash. | `push.ts:34-43`, `sms.ts:22-31`. |

---

## 5. Assumptions & constraints

- **A1** The Google Sheet is the single write path for roster/academic data; the
  app treats those tables as read-only outside the sync job / super-admin deletion.
- **A2** The school operates in one time zone (IST) and one academic-year cadence.
- **A3** iOS push requires the parent to install the PWA to the home screen and be
  on iOS 16.4+; urgent messaging should not rely on push alone (`push.ts:14-17`).
- **C1** `next build` cannot run fully offline because Next fetches Google Fonts at
  build time; verification uses `tsc` + `eslint` + Supabase impersonation instead
  (see doc 08 and project memory).
- **C2** Firebase Storage rules deny all direct client access by design; all file
  I/O goes through server route handlers using the Admin SDK (`storage.rules`).
