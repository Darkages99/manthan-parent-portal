# 04 — Data-Flow Specifications

This document traces how data moves through the system, from every source to every
sink. It covers: the generic read and write paths, then a detailed flow for each
significant feature, then the external/background flows. Each flow lists the
**trigger → identity/authorization → data touched → side effects → controls**.

The trust boundaries referenced (TB-1 … TB-8) are defined in
`02-architecture-and-trust-boundaries.md` §7.

---

## 1. Generic flows (the two patterns everything follows)

### 1.1 Generic READ (Server Component rendering a page)
```
Browser (auth cookie) ──TB-1──> proxy.ts (refresh session)
  ──> route-group layout: getViewer() → redirect if wrong actor type
  ──> Server Component: anon-key client query ──TB-2──> Postgres
        └── RLS filters rows to the caller (guardian's children / staff scope)
  ──> HTML rendered server-side, returned to browser
```
Key control: because the query uses the **anon-key** client, RLS runs. A parent's
query for "all students" returns only their linked children — the filtering is in
the database, not the code.

### 1.2 Generic WRITE (Server Action)
```
Browser ──TB-1 (POST, Next origin-checked)──> "use server" action
  ── getViewer()                         (authentication)
  ── requirePrincipal()/requireSuperAdmin()/ownership check   (authorization)
  ── validate & allowlist input fields   (input validation)
  ── write via anon-key client ──TB-2──> Postgres (RLS re-checks the write)
        │   OR (only where cross-cutting):
        └── service-role client (RLS bypassed) + in-code re-authorization
  ── optional side effect: sendPush / Sheets / Storage
  ── revalidatePath() → affected views refresh
```

---

## 2. Authentication & onboarding flows

### 2.1 Sign-in
- **Trigger:** user submits email/password, requests phone OTP, or chooses Google
  OAuth.
- **Path:** Supabase Auth issues a session; the token lands in httpOnly cookies.
  `/auth/callback` handles the OAuth/redirect return; `/post-login` routes the user
  to `/home` (guardian) or `/console` (staff).
- **Identity resolution:** `getViewer()` (`src/lib/session.ts`) validates the JWT
  with `auth.getUser()` (server-side validation — **not** the cookie-trusting
  `getSession()`), then looks up a `guardians` row, else an **active** `staff` row.
- **Controls:** inactive staff (`active=false`) resolve to `null` → no access
  (`session.ts:57`). Unlinked auth users get no access.

### 2.2 Account activation (`/activate`)
- **Trigger:** a new user activates their pre-provisioned account.
- **Data:** matches the supplied identity against the on-file **mobile number**
  (proof-of-ownership second factor) and sets a password (min length 8).
- **Client:** uses the service-role client to complete the link (re-authorized by
  the phone-match check). See finding F5 (`SECURITY_AUDIT.md`) — mitigated, with a
  future magic-link/OTP upgrade noted.

---

## 3. Attendance flow

### 3.1 Staff marks attendance (write)
```
Console /console/attendance ── saveAttendance action
  ── getViewer() must be staff
  ── upsert attendance_records (student_id, date, status[, half_day], marked_by)
        UNIQUE(student_id,date) makes re-marking idempotent
  ── RLS: staff full access (attendance is intentionally all-staff — front office
     marks school-wide; documented F3)
```
### 3.2 Parent views attendance (read)
```
Portal /attendance ── anon-key query attendance_records for own children
  ── RLS "guardian reads own children's attendance" filters rows
  ── attendance_summary(uuid[]) aggregates present/absent; UI shows donut with a
     distinct "not marked" slice (roster-relative %)
```

---

## 4. Results & report-card flow

### 4.1 Marks entry (write, scoped)
```
Console /console/results (or /results/subject) ── save-marks action
  ── getViewer() staff
  ── write exam_results
  ── RLS "staff writes results in scope": staff_can_edit_student_marks(student_id)
       = principal-tier OR teacher-of-that-student's-class/subject
  ── grade auto-filled from grade_boundaries for (subject, term)
```
### 4.2 Report-card PDF upload (write, file)
```
Console ── POST /api/report-card/upload  (single)  or  /bulk-upload (ZIP)
  ── validate session + staff
  ── bulk: jszip unpacks entries; filenames validated (zip-slip guard)
  ── uploadFileAdmin(path, bytes, contentType) ──TB-3──> Firebase Storage
       returns a token download URL
  ── store report_card_pdf_url on exam_results
```
### 4.3 Parent views results (read)
```
Portal /results ── anon-key query exam_results for own children (RLS-scoped)
  ── report card PDF fetched from Firebase via the stored token URL
```

---

## 5. Homework flow

```
Author (write):  Console /console/homework ── create/edit/delete homework_assignments (staff)
Status (write):  mark per-student not-submitted → homework_submissions;
                 teacher remark → homework_comments (staff)
Read (parent):   Portal /homework ── homework_assignments for own class (RLS) +
                 homework_comments for own children
Notify (background): cron → notifyUnsubmittedHomework() (lib/homework-notify.ts)
                 ── finds unsubmitted, dedups via homework_notifications,
                    sendPush() to the child's guardians, logs to notification_log
```

---

## 6. Leave flow

```
Raise (parent):  Portal /leave ── raiseLeave action
  ── getViewer() guardian
  ── insert leave_requests(requested_by=self, student_id=own child)
  ── RLS WITH CHECK binds requested_by=current_guardian_id() AND own child
Decide (staff):  Console /console/leave ── approve/decline
  ── set status, decided_by, decided_at
Read (parent):   status tracked in portal; staff queue ordered by leave date
```

---

## 7. Stay-back consent flow (multi-step approval)

This is the most elaborate workflow. Source: `src/app/(parent)/stay-back/actions.ts`,
`src/lib/stay-back-chain.ts`, `src/lib/approvals.ts`.

```
1. Parent raises (Portal /stay-back ── raiseStayBack):
     getViewer() guardian; validate all fields incl. transport mode
     look up the child's grade
     insert stay_back_consents (RLS WITH CHECK binds to own child)

2. Build approval chain (service-role client — RLS lets only staff write
   approval_steps, so admin client is used, re-authorized by the prior guardian
   check + WITH CHECK insert):
     buildStayBackChainSteps(teacherId, grade):
       named teacher → front office → [coordinator if grade < 8] → principal
     createApprovalChain() inserts ordered approval_steps

3. Notify (best-effort): sendPush() to the named teacher + all principals/super_admins
   ("stay_back" category); logged to notification_log. Others pick up from console.

4. Decide (staff, Console /console/stay-back):
     decideApprovalStep() matches the caller's open step (by role, or by
     pre-assigned approver_staff_id for the named teacher)
     computeSubjectStatus(): any decline → declined; all approved → approved
```
**Controls:** guardian cannot forge `raised_by_guardian_id` (WITH CHECK); cannot
write approval steps (staff-only RLS); cannot decide (staff-only).

---

## 8. PTM flow

```
Create (staff):  Console /console/ptm ── create ptm_meetings + ptm_meeting_teachers,
                 then open ptm_slots
Book (parent):   Portal /ptm ── bookSlot: claim a slot for own child;
                 creates an approval chain (ptm_slot_request: principal + named teacher)
                 via the service-role client (mirror of stay-back)
Cancel (parent): releases the slot
Guard:           a meeting cannot be deleted while any slot is booked/pending
Notify:          all meeting teachers notified on a booking decision
```

---

## 9. Consultation flow

```
Request (parent): Portal /consultations ── insert parent_consultations
  ── DB CHECK forces preferred_date to a Tuesday or Thursday
  ── RLS WITH CHECK binds requested_by + own child
Schedule (staff): Console /console/consultations ── set status/scheduled_time/note
Cancel (parent):  guardian UPDATE allowed only to status='cancelled' (RLS)
```

---

## 10. Messaging flow

```
Compose (staff): Console /console/messages/compose ── send action
  ── permission check: message_send_permissions(role, scope_type) must allow
  ── teacher scope: requireTeacherScope / group access (custom_group_staff_access)
     — teachers cannot send school-wide
  ── insert messages + message_targets (+ message_attachments via upload route)
  ── resolve recipients (service-role client, compose/actions.ts): expand
     school/class/student/group scope → guardian set → insert message_receipts
  ── sendPush() to recipients ("messages"); logged to notification_log
Read (parent):  Portal /messages ── messages resolved to me (via receipts/targets RLS)
  ── mark read: guardian UPDATE own message_receipts.read_at (RLS-scoped)
  ── unread badge from receipts
Attachments:    POST /api/attachments/upload ── uploader must own the message;
                messageId UUID-validated; filename sanitized to a basename ──TB-3──> Firebase
```

---

## 11. Report-an-issue flow

```
Raise (parent or staff): choose audience (principal_only | front_office_and_principal)
  and optional directed teacher(s)
  ── insert reported_issues (+ reported_issue_recipients)
  ── app forces audience=front_office_and_principal when recipients attached
Visibility (RLS): reporter always; principal-tier always; front office if audience
  includes them; a directed teacher via current_staff_is_issue_recipient()
Resolve (staff): any staff who can see it may resolve it
```

---

## 12. Notification fan-out (shared sink)

Single choke point: `sendPush(targets, payload, category)` in
`src/lib/notifications/push.ts` (service-role client). Every feature routes through
it, so logging and preferences are uniform.

```
sendPush:
  ── filterByPreference(): drop targets that disabled this category
     (notification_preferences; absence = enabled)
  ── read push_subscriptions for remaining targets
  ── webpush.sendNotification() per device (VAPID) ──TB-5──> browser/FCM
  ── prune subscriptions returning 404/410 (dead endpoints)
  ── insert notification_log (one row per target, delivered flag) — durable proof
```
Fallbacks: SMS via `getSmsRelay()` (Android relay, `sms.ts`) and WhatsApp
click-to-chat links (`whatsapp.ts`, human presses send) for urgent 1:1 cases.

---

## 13. Roster / academic-config sync flow (external, background)

Source: `src/lib/google-sheets.ts`. Runs under the **service-role** client as
trusted background work; the Sheet is the single write path for roster/academic
tables (students, guardians, staff, class_sections, subjects, timetable).

```
Trigger: daily cron (GET /api/cron/tick) OR staff "Sync now" (console/sync)
syncFromSheet():
  1. Open a sheet_sync_runs row (status=running)
  2. Authenticate to Sheets/Drive with the service-account JWT ──TB-4
  3. For each tab in dependency order — Teachers → ClassSections → Subjects →
     Students → Guardians → Timetable:
       a. If the tab is completely empty, export current Postgres rows into it
          (seed), so an empty tab is "not seeded" not "everything deleted".
       b. Read rows; for each: blank id = insert, present id = update.
       c. Resolve human-readable cross-refs (class label, teacher name, roll no).
       d. Guardians go through sync_upsert_guardian() RPC (atomic upsert + relink,
          satisfies the deferred integrity triggers).
       e. Write generated id + a per-row "Sync Status" (OK / Error: …) back to the sheet.
  4. queuePendingDeletions(): any Postgres row whose id wasn't seen this pass is
     inserted into sheet_sync_pending_deletions (snapshot kept) — NOT deleted.
  5. writePendingDeletionsTab(): mirror the unresolved queue into a red-highlighted
     "Pending Deletions" tab.
  6. Close the run row (status=success | failed + error_summary). Never throws.
```
**Confirm deletion (destructive):** Console /console/sync/pending-deletions ──
`requireSuperAdmin()` + a table allowlist ── the only place a queued row is actually
deleted from Postgres (`SECURITY_AUDIT.md` notes this as a solid control).

**Provisioning:** `provisionSheet()` creates the spreadsheet, writes headers, and
shares it (Drive API) with every principal/super_admin who has an email on file.

---

## 14. Cron flow

```
Vercel Cron (0 3 * * *, region bom1) ──TB-7──> GET /api/cron/tick
  ── require Authorization: Bearer CRON_SECRET; fail closed if unset/empty
  ── Promise.allSettled([ syncFromSheet(), notifyUnsubmittedHomework() ])
  ── return per-job status (never leaks internals)
```

---

## 15. File storage flow (all uploads/downloads)

```
Upload:   route handler ── uploadFileAdmin(path, bytes, contentType)
            ── Firebase Admin SDK writes object with a random download token
            ── returns https://firebasestorage.../o/<path>?alt=media&token=<uuid>
Store:    the token URL is saved on the owning row (exam_results.report_card_pdf_url,
          payments.receipt_pdf_url, message_attachments.storage_url)
Download: the browser fetches the token URL directly. The token is a bearer
          credential that deliberately bypasses Storage rules (which deny all
          direct client access). Knowledge of the URL = access.
Usage:    getBucketUsageBytes() paginates all objects for the storage snapshot.
```
**Control:** because Storage rules deny everything (`storage.rules`), there is no
client path to the bucket except a token URL that only the server can mint. Path
traversal is prevented by server-side path generation + basename sanitization
(finding F7).

---

## 16. Data-source-to-sink summary table

| Data | Source of truth | Written by | Read by | Files/side channel |
|------|-----------------|-----------|---------|--------------------|
| Roster (students, guardians, staff, classes, subjects, timetable) | Google Sheet | sync job (service-role) + super-admin deletions | staff (all), guardians (own children) | Google Sheets/Drive |
| Attendance | app | staff | staff, guardian (own) | — |
| Results / grades | app | scoped teacher / principal-tier | staff, guardian (own) | Firebase (report cards) |
| Homework | app | staff | staff, guardian (own) | push |
| Requests (leave, stay-back, PTM, consultation) | app | guardian (raise), staff (decide) | both (scoped) | push, WhatsApp/SMS |
| Messages | app | staff | guardian recipients | Firebase (attachments), push |
| Issues | app | guardian/staff (raise), staff (resolve) | audience-scoped | — |
| Notifications | app | `sendPush` (service-role) | principal-tier (log) | web-push/FCM, SMS relay |
| Finance | app | staff (accounts) | (deny-all today) | Firebase (receipts) |
| Files | app | route handlers (Admin SDK) | anyone with the token URL | Firebase Storage |
