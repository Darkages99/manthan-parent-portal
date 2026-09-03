# 11 — Requirements Traceability Matrix

The join table for the whole document set: every functional requirement (from doc
01 §3) mapped to the module that realizes it (doc 06), the primary source file(s),
the database tables + governing RLS, and the test level(s) that verify it. Use this
to answer "where is requirement X built and how is it proven?"

Test-level codes: **L1** static · **L3** RLS impersonation · **L4** integration ·
**L5** E2E · **L6** UAT (`FEATURES.md`). Full method in doc 08.

---

## 1. Functional requirements

| Req | Module | Primary source | Tables | RLS / gate | Tests |
|-----|--------|----------------|--------|-----------|-------|
| FR-AUTH-1 | Auth | `auth/*`, `activate/*` | `auth.users`, `guardians`, `staff` | Supabase Auth | L4,L5,L6 |
| FR-AUTH-2 | Auth | `lib/session.ts` | `guardians`, `staff` | `getViewer` + active flag | L4,L6 |
| FR-AUTH-3 | Auth | `activate/actions.ts` | `guardians`/`staff` | phone-match | L4 |
| FR-AUTH-4 | Auth | RLS in all migrations | all guardian tables | `current_guardian_id()` | **L3**,L4 |
| FR-AUTH-5 | Auth | `lib/roles.ts` | `staff` | `requirePrincipal/SuperAdmin` | L3,L4 |
| FR-ATT-1 | Attendance | `console/attendance/actions.ts` | `attendance_records` | staff | L4,L6 |
| FR-ATT-2 | Attendance | `(parent)/attendance` | `attendance_records` | guardian own | L3,L5,L6 |
| FR-ATT-3 | Attendance | `defaulters-view.tsx` | `attendance_records` | staff | L6 |
| FR-RES-1 | Results | `results/actions.ts`, `results-scope.ts` | `exam_results` | `staff_can_edit_student_marks` | **L3**,L4 |
| FR-RES-2 | Results | `results/subject/actions.ts`, `grade-boundaries.ts` | `subject_grading_config`, `grade_boundaries` | staff | L4,L6 |
| FR-RES-3 | Results | `api/report-card/upload`, `/bulk-upload` | `exam_results` + Firebase | staff + upload guards | L4 |
| FR-RES-4 | Results | `(parent)/results` | `exam_results` | guardian own | L3,L5,L6 |
| FR-RES-5 | Results | `results-analytics.tsx` | `exam_results` | staff | L6 |
| FR-HW-1 | Homework | `console/homework/actions.ts` | `homework_assignments` | staff | L4,L6 |
| FR-HW-2 | Homework | `console/homework/*` | `homework_submissions`, `homework_comments` | staff | L4,L6 |
| FR-HW-3 | Homework | `(parent)/homework` | `homework_assignments`, `homework_comments` | guardian own | L3,L6 |
| FR-HW-4 | Homework | `lib/homework-notify.ts` | `homework_notifications`, `notification_log` | service-role | L4 |
| FR-TT-1 | Timetable | `console/timetable/actions.ts` | `timetable_periods`, `timetable_entries` | principal-tier | L3,L4,L6 |
| FR-TT-2 | Timetable | `(parent)/timetable` | `timetable_entries` | guardian class | L3,L6 |
| FR-TT-3 | Timetable | `console/classes/[id]` | `class_subject_teachers` | principal-tier | L4,L6 |
| FR-LV-1 | Leave | `(parent)/leave/actions.ts` | `leave_requests` | guardian WITH CHECK | **L3**,L4 |
| FR-LV-2 | Leave | `console/leave/actions.ts` | `leave_requests` | staff | L4,L6 |
| FR-LV-3 | Leave | `leave-status.ts` | `leave_requests` | scoped | L6 |
| FR-SB-1 | Stay-back | `(parent)/stay-back/actions.ts` | `stay_back_consents` | guardian WITH CHECK | **L3**,L4 |
| FR-SB-2 | Stay-back | `lib/stay-back-chain.ts`, `lib/approvals.ts` | `approval_steps` | staff (admin client) | L4 |
| FR-SB-3 | Stay-back | `lib/approvals.ts` | `approval_steps` | `computeSubjectStatus` | L2(planned),L4 |
| FR-SB-4 | Stay-back | `stay-back/actions.ts` | `notification_log` | service-role | L4 |
| FR-PTM-1 | PTM | `console/ptm/actions.ts` | `ptm_meetings`, `ptm_meeting_teachers`, `ptm_slots` | staff | L4,L6 |
| FR-PTM-2 | PTM | `(parent)/ptm/actions.ts` | `ptm_slots`, `approval_steps` | guardian class | L3,L4 |
| FR-PTM-3 | PTM | `console/ptm/actions.ts` | `ptm_meetings`, `ptm_slots` | delete guard | L4,L6 |
| FR-CON-1 | Consultations | `(parent)/consultations/actions.ts` | `parent_consultations` | Tue/Thu CHECK + WITH CHECK | **L3**,L4 |
| FR-CON-2 | Consultations | `console/consultations/actions.ts` | `parent_consultations` | staff / cancel-only | L3,L4,L6 |
| FR-MSG-1 | Messaging | `messages/compose/actions.ts` | `messages`, `message_targets` | send perms | L4,L6 |
| FR-MSG-2 | Messaging | `messages/permissions`, `groups` | `message_send_permissions`, `custom_group_staff_access` | principal-tier / teacher scope | **L3**,L4 |
| FR-MSG-3 | Messaging | `(parent)/messages` | `message_receipts` | guardian own | L3,L5,L6 |
| FR-MSG-4 | Messaging | `bulk-message-csv-import.tsx` | `messages` | staff | L6 |
| FR-ISS-1 | Issues | `(parent)/report-issue/actions.ts` | `reported_issues`, `reported_issue_recipients` | reporter | L4 |
| FR-ISS-2 | Issues | `0039` policies | `reported_issues` | audience/directed RLS | **L3** |
| FR-ISS-3 | Issues | `console/issues/actions.ts` | `reported_issues` | visible-staff resolve | L3,L4 |
| FR-MISC-1 | DTR | `console/calendar`, `(parent)/dtr` | `dtr_events`, `dtr_event_classes` | staff write/all read | L6 |
| FR-MISC-2 | Competitions | `console/competitions` | `competitions` | principal-tier | L6 |
| FR-MISC-3 | Defaulters | `console/defaulters` | `defaulter_records` | staff / guardian own | L3,L6 |
| FR-MISC-4 | QR | `console/qr-codes`, `lib/qr` | `student_qr_codes` | principal write / scoped read | L3,L6 |
| FR-MISC-5 | Gallery | `console/gallery`, `(parent)/gallery` | (Firebase) | staff upload | L6 |
| FR-NOTIF-1 | Notifications | `lib/notifications/push.ts` | `push_subscriptions`, `notification_log` | service-role | L4 |
| FR-NOTIF-2 | Notifications | `settings/notifications/actions.ts` | `notification_preferences` | owner | L3,L4 |
| FR-NOTIF-3 | Notifications | `lib/notifications/sms.ts`, `whatsapp.ts` | — | server/client | L4 |
| FR-SYNC-1 | Sync | `lib/google-sheets.ts` | roster tables, `sheet_sync_runs` | service-role | L4 |
| FR-SYNC-2 | Sync | `google-sheets.ts` (`queuePendingDeletions`) | `sheet_sync_pending_deletions` | service-role | L4 |
| FR-SYNC-3 | Sync | `sync/pending-deletions/actions.ts` | roster tables | `requireSuperAdmin` + allowlist | **L3**,L4 |
| FR-SYNC-4 | Sync | `google-sheets.ts` | `sheet_sync_runs` | service-role | L4 |
| FR-ADMIN-1 | Admin | `console/staff/actions.ts` | `staff` | super_admin / principal split (0050) | **L3**,L4 |
| FR-ADMIN-2 | Admin | `console/storage/actions.ts` | `storage_usage_snapshots` | principal-tier | L3,L4 |
| FR-ADMIN-3 | Admin | `console/notification-log` | `notification_log` | principal-tier read | L3 |

---

## 2. Non-functional requirements

| Req | Control | Source | Test |
|-----|---------|--------|------|
| NFR-1 Confidentiality | RLS on all tables | all migrations | **L3** + `SECURITY_AUDIT.md` §5 |
| NFR-2 Auditability | notification log; queued deletions | 0042; 0017 | L4 |
| NFR-3 Integrity | deferred constraint triggers + RPCs | 0040 | L4 (add/remove-parent cases) |
| NFR-4 Low cost | managed platforms; free notification paths | `sms.ts`, `whatsapp.ts` | review |
| NFR-5 Portability | standalone build + Docker | `next.config.ts`, `Dockerfile` | build check |
| NFR-6 Headers | six security headers | `next.config.ts:7-14` | header inspection |
| NFR-7 Typed contract | generated DB types | `database.types.ts` | L1 |
| NFR-8 Verifiability | RLS suite + E2E | doc 08; `e2e/` | L3,L5 |
| NFR-9 IST localization | IST formatting | sync/log code | review |
| NFR-10 Degradation | no-op when optional integrations unset | `push.ts`, `sms.ts` | L4 |

---

## 3. Security findings → status (from `SECURITY_AUDIT.md`)

| Finding | Severity | Status | Where fixed |
|---------|----------|--------|-------------|
| F1 staff PII exposure | High | ✅ Fixed | 0050 (`staff_directory` view) |
| F2 super_admin escalation | High | ✅ Fixed | 0050 (policy split) |
| F3 marks write-scope | Medium | ✅ Fixed | 0050 (`staff_can_edit_student_marks`) |
| F4 push_subscriptions no policy | Medium | ✅ Fixed | 0050 (owner policy) |
| F5 activation takeover | Medium | ⚠️ Mitigated | phone-match; magic-link roadmap |
| F6 CSV injection | Medium | ✅ Fixed | `lib/csv.ts` |
| F7 attachment IDOR/path | Medium | ✅ Fixed | upload route |
| F8 security headers | Medium | ✅ Fixed | `next.config.ts` |
| F9 dependency advisories | Medium | ⚠️ Partial | `npm audit fix`; firebase-admin major pending |
| F10 cron fail-open | Low | ✅ Fixed | `cron/tick/route.ts` |
| F11 password floor / HIBP | Low | ⚠️ Partial | min-8; HIBP toggle = dashboard |
| F12 anon EXECUTE on fns | Low | ✅ Fixed | 0050 revokes |
| F13 mutable search_path | Low | ✅ Fixed | 0050 pins |
| F14 payments deny-all | Info | ▫️ Noted | by design |
| F15 dual-role staff read | Info | ▫️ Noted | expected |
| F16 redundant staff policies | Info | ✅ Fixed | 0050 |

Open owner-actions (not code): F11 (HIBP toggle), F9 (firebase-admin upgrade), F5
(magic-link upgrade).

---

## 4. Governance gaps → status (updated 2026-09-03 remediation)

| ID | Gap | Status | Where fixed / residual |
|----|-----|--------|------------------------|
| DG-1 | Automated retention + right-to-erasure | ✅ Closed | `prune_old_records`, `erase_student` (migration `0052`); `eraseStudent` action + cron wiring. Residual: confirm retention windows. |
| DG-2 | Core PII duplicated to Google Sheet | 🟡 Mitigated | Sheet shared only with principal/super_admin (`provisionSheet`); duplication remains by design — include in archive/erasure procedure. |
| DG-3 | Versioned audit trail for academic edits | ✅ Closed | `audit_log` + triggers on `exam_results`/`attendance_records` (migration `0051`). |
| DG-4 | PII in server logs | ✅ Closed (app) | `logError` (`src/lib/log.ts`) + all call sites scrubbed. Residual: Vercel log-store access/retention. |
| DG-5 | Notification consent posture | ✅ Decided | School keeps **opt-out** (default-on); recorded in 09 §5/§8. |

**New requirements introduced by the remediation** (traced like functional reqs):

| Req | Control | Source | Tests |
|-----|---------|--------|-------|
| DG-1a Retention | `prune_old_records()` daily | migration 0052; `api/cron/tick` | L3 (rolled-back exec), L4 |
| DG-1b Erasure | `erase_student()` + `eraseStudent` | migration 0052; `console/students/actions.ts`; `firebase/admin-storage.ts` | **L3** (rolled-back erase, deferred-constraint check, super-admin gate) |
| DG-3 Audit | `audit_row_change()` triggers | migration 0051 | **L3** (trigger fires; guardian read=0; principal read) |
| DG-4 Log hygiene | `logError` everywhere | `src/lib/log.ts` + call sites | L1 |

---

*End of document set. Keep this matrix updated whenever a requirement, module,
table, policy, or test changes — it is the index auditors will read first.*
