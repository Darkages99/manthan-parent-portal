# 06 — Functional Modules & Requirements

One section per feature module. Each states its purpose, the actors and their
capabilities, the tables and RLS it relies on, the source files that implement it,
and the business rules/invariants. Requirement IDs (`FR-*`) are defined in
`01-system-overview-and-requirements.md` §3 and traced in doc 11.

Conventions: **Parent** = `parent` role; **Staff** = any staff role;
**Principal-tier** = principal/super_admin/coordinator.

---

## 1. Identity & access
- **Requirements:** FR-AUTH-1..5.
- **Actors:** all.
- **Tables:** `guardians`, `staff`, `staff_directory` (view), `auth.users`.
- **Source:** `src/lib/session.ts`, `src/lib/roles.ts`, `src/app/auth/*`,
  `src/app/activate/*`, `src/app/post-login/*`, `src/proxy.ts`.
- **Rules:** one resolved viewer per user; inactive staff = no access; activation
  requires phone match; role gates as in doc 05 §3.

## 2. Attendance
- **Requirements:** FR-ATT-1..3.
- **Parent:** view own child history + summary (donut with a distinct "not marked"
  slice; present % is roster-relative).
- **Staff:** mark daily attendance (present/absent/late/excused, half-day);
  "mark today" prompt + nav badge; defaulters/absent-today view.
- **Tables:** `attendance_records` (UNIQUE student+date); helper `attendance_summary()`.
- **Source:** `console/attendance/*`, `(parent)/attendance/*`, components
  `attendance-*.tsx`, `defaulters-view.tsx`.
- **Rules:** one record per child per day (idempotent re-mark); writes all-staff by
  design (front office marks school-wide).

## 3. Results & report cards
- **Requirements:** FR-RES-1..5.
- **Parent:** view results + report-card PDF (read-only).
- **Staff:** enter marks (scoped), configure per-subject/term grade scale, upload
  report cards (single + bulk ZIP), view analytics.
- **Tables:** `exam_results`, `subject_grading_config`, `grade_boundaries`.
- **Source:** `console/results/*`, `console/results/subject/*`,
  `console/report-cards/*`, `api/report-card/upload`, `api/report-card/bulk-upload`,
  `(parent)/results/*`, `src/lib/results-scope.ts`, `src/lib/grade-boundaries.ts`,
  `src/lib/results-analytics.ts`.
- **Rules:** marks writable only by principal-tier or the student's own teacher
  (`staff_can_edit_student_marks`); grade auto-fills from bands; report-card PDFs in
  Firebase.

## 4. Homework
- **Requirements:** FR-HW-1..4.
- **Parent:** view class homework + teacher comment for own child.
- **Staff:** author/edit/delete; mark per-student not-submitted; add remark.
- **Tables:** `homework_assignments`, `homework_submissions`, `homework_notifications`
  (dedup), `homework_comments`.
- **Source:** `console/homework/*`, `(parent)/homework/*`,
  `src/lib/homework-notify.ts`, components `homework-*.tsx`.
- **Rules:** default-submitted design (a row is a not-done override, 0036); one
  "not-done" push per assignment via the dedup ledger; dispatched by cron.

## 5. Timetable
- **Requirements:** FR-TT-1..3.
- **Parent:** view own child's class timetable.
- **Staff (principal-tier):** edit period structure and weekly grid; teacher picker
  suggests assigned teachers.
- **Tables:** `timetable_periods`, `timetable_entries`, `subjects`,
  `class_subject_teachers`.
- **Source:** `console/timetable/*`, `(parent)/timetable/*`, `console/classes/[id]`,
  components `timetable-*.tsx`, `period-editor.tsx`, `class-detail.tsx`.
- **Rules:** one cell per class/day/period; day 1(Mon)–6(Sat); CSV import currently
  flagged off pending format finalization (`FEATURES.md`).

## 6. Leave
- **Requirements:** FR-LV-1..3. **Tables:** `leave_requests`.
- **Source:** `(parent)/leave/*`, `console/leave/*`, `src/lib/leave-status.ts`,
  `leave-form.tsx`, `leave-approval-list.tsx`.
- **Rules:** guardian raises for own child (RLS `WITH CHECK`); staff decide; pending
  queue ordered by leave date.

## 7. Stay-back consent
- **Requirements:** FR-SB-1..4. **Tables:** `stay_back_consents`, `approval_steps`.
- **Source:** `(parent)/stay-back/*`, `console/stay-back/*`,
  `src/lib/stay-back-chain.ts`, `src/lib/stay-back-transport.ts`,
  `src/lib/approvals.ts`, `approval-chain.tsx`, `stay-back-*.tsx`.
- **Rules:** grade-conditional chain (named teacher → front office → [coordinator if
  grade < 8] → principal); any decline closes it; named teacher + principals
  notified immediately; transport mode required.

## 8. Parent-teacher meetings (PTM)
- **Requirements:** FR-PTM-1..3.
- **Tables:** `ptm_meetings`, `ptm_meeting_teachers`, `ptm_slots`, `approval_steps`.
- **Source:** `console/ptm/*`, `(parent)/ptm/*`, `create-ptm-form.tsx`,
  `meeting-slot-manager.tsx`, `ptm-view.tsx`.
- **Rules:** staff create meeting + open slots; parent books/cancels for own child;
  booking creates a principal + named-teacher chain; meeting undeletable while any
  slot booked/pending; all meeting teachers notified on a decision.

## 9. Consultations
- **Requirements:** FR-CON-1..2. **Tables:** `parent_consultations`.
- **Source:** `(parent)/consultations/*`, `console/consultations/*`,
  `consultation-*.tsx`.
- **Rules:** Tue/Thu only (DB CHECK); parent supplies availability note; front
  office/principal schedule/decline; parent may only cancel.

## 10. Messaging
- **Requirements:** FR-MSG-1..4.
- **Tables:** `messages`, `message_targets`, `message_attachments`,
  `message_receipts`, `custom_groups`, `custom_group_students`,
  `custom_group_staff_access`, `message_send_permissions`.
- **Source:** `console/messages/*` (compose/groups/permissions),
  `(parent)/messages/*`, `api/attachments/upload`, `compose-form.tsx`,
  `bulk-message-csv-import.tsx`, `message-permissions-grid.tsx`,
  `notifications-inbox.tsx`.
- **Rules:** send subject to `message_send_permissions(role, scope_type)`; teachers
  scoped to their taught classes/students/groups and cannot send school-wide;
  principal-tier manages the grid and group-access grants; read receipts;
  attachments require message ownership.

## 11. Report an issue
- **Requirements:** FR-ISS-1..3. **Tables:** `reported_issues`,
  `reported_issue_recipients`.
- **Source:** `(parent)/report-issue/*`, `console/issues/*`,
  `report-issue-form.tsx`, `issue-triage-list.tsx`.
- **Rules:** audience (principal_only | front_office_and_principal) + optional
  directed teacher(s); directed reports force the wider audience; visibility per
  RLS; any staff who can see it may resolve.

## 12. Calendar (DTR), competitions, defaulters, gallery, QR
- **Requirements:** FR-MISC-1..5.
- **DTR:** `dtr_events`/`dtr_event_classes`; staff write, all read; per-class or
  whole-school (`console/calendar`, `(parent)/dtr`).
- **Competitions:** `competitions`; principal-tier manage, all read; informational.
- **Defaulters:** `defaulter_records`; staff record, parent reads own child.
- **Gallery:** staff upload media, parent views (`(parent)/gallery`,
  `console/gallery`).
- **QR:** `student_qr_codes`; principal-tier issue/rotate opaque token, staff read
  (scan), guardian reads own child; `console/qr-codes`, `src/lib/qr/*`.

## 13. Notifications & preferences
- **Requirements:** FR-NOTIF-1..3.
- **Tables:** `push_subscriptions`, `notification_preferences`, `notification_log`.
- **Source:** `src/lib/notifications/*`, `src/app/actions/push.ts`,
  `(parent)/settings/notifications/*`, `console/notification-log/*`,
  `push-toggle.tsx`, `notification-settings-view.tsx`.
- **Rules:** per-category opt-out (absence = enabled); every push logged; SMS/
  WhatsApp are 1:1 urgent fallbacks; dead subscriptions pruned on 404/410.

## 14. Roster / academic-config sync
- **Requirements:** FR-SYNC-1..4.
- **Tables:** all roster tables + `sheet_sync_runs`, `sheet_sync_pending_deletions`.
- **Source:** `src/lib/google-sheets.ts`, `console/sync/*`,
  `console/sync/pending-deletions/*`, `api/cron/tick`, `sheet-sync-controls.tsx`,
  `pending-deletions-list.tsx`.
- **Rules:** sheet is the single write path; additions/amendments auto-apply;
  missing rows queued, never auto-deleted; only super_admin confirms deletion;
  every run recorded.

## 15. Administration
- **Requirements:** FR-ADMIN-1..3.
- **Staff management:** `console/staff/*` — super_admin manages all incl.
  super_admin; principal/coordinator manage non-super_admin (0050).
- **Students/parents management:** `console/students/*`, `console/parents/*` — via
  integrity RPCs (`create_student_with_guardians`, `replace_guardian_children`).
- **Storage snapshot:** `console/storage/*` — principal-tier computes DB + file
  usage snapshot.
- **Notification log:** `console/notification-log/*` — principal-tier audit view.
- **Classes:** `console/classes/*` — assign class teacher, subject teachers.

---

## Cross-module invariants
1. A parent only ever sees/acts on their own children (RLS backbone).
2. Guardians cannot self-link students (staff-only `guardian_student` writes).
3. Destructive roster deletion requires explicit super-admin confirmation.
4. Every notification attempt is durably logged (proof-of-notification).
5. Data-integrity: student ≥1 parent; guardian child-or-email (deferred triggers).
