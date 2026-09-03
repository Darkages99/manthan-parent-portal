# 03 — Data Dictionary

The complete catalogue of the database: every enum type, every table with all
columns/types/constraints, every relationship, and a summary of the RLS policy on
each table. This is the definitive answer to "what data does the system hold and
how is it connected."

**Authoritative source:** `supabase/migrations/0001_init.sql` … `0052_data_retention_and_erasure.sql`.
All column and constraint facts below are taken directly from those files. Where a
later migration altered an earlier table, the current state is described and the
altering migration noted.

**Scope:** ~49 live tables (one, `reminders`, is deprecated — see §5.7;
`audit_log` added in migration 0051 — see §6.5a). Every table has RLS **enabled**.
The extension `pgcrypto` provides `gen_random_uuid()`.

---

## 1. Enumerated types

| Enum | Values | Defined in |
|------|--------|-----------|
| `role` | `parent`, `class_teacher`, `front_office`, `accounts`, `principal`, `super_admin`, `coordinator` (+ legacy `admin`) | 0001:12, +0009, +0030 |
| `attendance_status` | `present`, `absent`, `late`, `excused` | 0001:62 |
| `leave_status` | `pending`, `approved`, `declined` | 0001:73 |
| `stay_back_status` | `pending`, `approved`, `declined` | 0001:95 |
| `approval_decision` | `approved`, `declined` | 0001:96 |
| `dtr_category` | `exam`, `holiday`, `event`, `deadline`, `ptm`, `other` | 0001:119 |
| `invoice_status` | `due`, `partially_paid`, `paid`, `overdue` | 0001:142 |
| `message_scope_type` | `school`, `class`, `student`, `group` | 0001:223 |
| `ptm_status` | `open`, `closed` | 0006:10 |
| `approval_subject_type` | `stay_back_consent`, `ptm_slot_request` | 0010:6 |
| `approval_step_role` | `class_teacher`, `front_office`, `coordinator`, `principal` | 0010:7 |
| `stay_back_purpose` | `cultural`, `project`, `competitions_prep`, `ihc`, `others` | 0011 |
| `notification_category` | `stay_back`, `leave`, `ptm`, `messages`, `reminders`, `defaulters` | 0015:4 |
| `issue_status` | `open`, `resolved` | 0019:4 |
| `issue_audience` | `principal_only`, `front_office_and_principal` | 0039:14 |
| `consultation_status` | `pending`, `scheduled`, `declined`, `cancelled` | 0044 |

---

## 2. Entity-relationship overview

The central relationship — and the backbone of all access control — is the
many-to-many between guardians and students:

```
guardians ──< guardian_student >── students ──> class_sections ──> staff (class_teacher_id)
    │                                  │
    │                                  ├──< attendance_records
    │                                  ├──< exam_results ──(report card PDF → Firebase)
    │                                  ├──< defaulter_records
    │                                  ├──< student_qr_codes (1:1)
    │                                  ├──< homework_submissions / _notifications / _comments
    │                                  ├──< invoices ──< payments ──(receipt PDF → Firebase)
    │                                  ├──< ptm_slots (booked_student_id)
    │                                  └──< parent_consultations
    │
    ├──< leave_requests (requested_by)
    ├──< stay_back_consents (raised_by_guardian_id) ──< approval_steps
    ├──< message_receipts >── messages ──< message_targets / _attachments
    ├──< push_subscriptions / notification_preferences
    └──< reported_issues ──< reported_issue_recipients

class_sections ──< timetable_entries >── timetable_periods / subjects / staff
class_sections ──< class_subject_teachers >── subjects / staff
class_sections ──< ptm_meetings ──< ptm_meeting_teachers / ptm_slots
custom_groups ──< custom_group_students / custom_group_staff_access
```

RLS reads all trace back through `guardian_student = current_guardian_id()` for
parents, or `is_staff()` / `current_staff_role()` for staff.

---

## 3. Identity & structural tables

### 3.1 `staff` — school employee accounts
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `auth_user_id` | uuid FK→`auth.users` | on delete set null; links to Supabase Auth |
| `name` | text NOT NULL | |
| `role` | `role` NOT NULL | see enum |
| `phone` | text NOT NULL | |
| `email` | text | added 0022 |
| `username` | text | login username, added 0031 |
| `active` | boolean | active-flag, added 0026; inactive staff get no access (`session.ts:57`) |
| `created_at` | timestamptz NOT NULL | `now()` |

**RLS (current, per 0050):** base table SELECT restricted to `is_staff()`
("staff reads all staff"). Guardians never read the base table — they read the
`staff_directory` **view** (id/name/role/active only). Writes split: super_admin
manages all rows incl. super_admin; principal/coordinator manage non-super_admin
rows only. This closes the F1 (PII exposure) and F2 (privilege escalation)
findings.

### 3.2 `staff_directory` — safe teacher view (0050)
A view (`security_invoker = false`) exposing only `id, name, role, active` from
`staff`, granted SELECT to `authenticated`. Used by parent-facing teacher pickers
(report-issue, stay-back, ptm, timetable).

### 3.3 `class_sections` — a class-division for an academic year
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `academic_year` | text NOT NULL | e.g. `2026-27` |
| `grade` | text NOT NULL | |
| `section` | text NOT NULL | |
| `class_teacher_id` | uuid FK→`staff` | |
| UNIQUE | (academic_year, grade, section) | |

**RLS:** any authenticated user reads (non-sensitive reference data); staff write.

### 3.4 `students` — enrolled children
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `first_name`,`last_name` | text NOT NULL | |
| `roll_no` | text NOT NULL | |
| `class_section_id` | uuid FK→`class_sections` NOT NULL | |
| `photo_url` | text | |
| `created_at` | timestamptz NOT NULL | |

**RLS:** staff read all; a guardian reads a student only if linked via
`guardian_student`. Staff write policy added 0027; the manual add path goes through
`create_student_with_guardians()` to enforce "≥1 parent" (0040).

### 3.5 `guardians` — parent/guardian accounts
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `auth_user_id` | uuid FK→`auth.users` | on delete set null |
| `name` | text NOT NULL | |
| `relation` | text NOT NULL | |
| `phone` | text NOT NULL | |
| `email` | text | |
| `created_at` | timestamptz NOT NULL | |

**RLS:** a guardian reads only their own row (`auth_user_id = auth.uid()`); staff
read all; staff write added 0038. Integrity: a guardian must have a linked child
**or** an email (deferred trigger, 0040).

### 3.6 `guardian_student` — the guardian↔student link (join)
| Column | Type | Notes |
|--------|------|-------|
| `guardian_id` | uuid FK→`guardians` | on delete cascade |
| `student_id` | uuid FK→`students` | on delete cascade |
| PK | (guardian_id, student_id) | |

**RLS:** a guardian reads only their own links; staff read/write. **A guardian
cannot insert a link** (writes are staff-only) — this is the single most important
control: it prevents a parent from granting themselves access to another child.
Deferred trigger enforces "a student keeps ≥1 parent" on link removal (0040).

---

## 4. Academic & records tables

### 4.1 `attendance_records`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid FK→`students` NOT NULL | |
| `date` | date NOT NULL | |
| `status` | `attendance_status` NOT NULL | |
| `half_day` | (added 0004) | half-day support |
| `marked_by` | uuid FK→`staff` | |
| UNIQUE | (student_id, date) | one record per child per day |

**RLS:** guardian reads own children's; staff full access. Attendance writes are
intentionally **all-staff** (front office marks school-wide) — documented decision
in `SECURITY_AUDIT.md` F3. Helper `attendance_summary(uuid[])` (0005) aggregates.

### 4.2 `exam_results`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid FK→`students` NOT NULL | |
| `term` | text NOT NULL | e.g. `Term 2` |
| `subject` | text NOT NULL | |
| `marks` | numeric NOT NULL | |
| `max_marks` | numeric NOT NULL | |
| `grade` | text | auto-filled from boundaries |
| `report_card_pdf_url` | text | Firebase Storage URL |

**RLS (current, per 0050):** staff read all; **writes scoped** via
`staff_can_edit_student_marks(student_id)` — principal-tier, or the teacher of that
student's class/subject (class teacher, timetable teacher, or class_subject_teacher).
Guardians read own children's only. This closes finding F3 (marks).

### 4.3 `subject_grading_config` (0049)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `subject` | text NOT NULL | |
| `term` | text NOT NULL | |
| `max_marks` | numeric NOT NULL default 100 | |
| UNIQUE | (subject, term) | |

### 4.4 `grade_boundaries` (0049)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `subject`,`term`,`grade` | text NOT NULL | |
| `min_pct`,`max_pct` | numeric NOT NULL | percentage band → letter |
| UNIQUE | (subject, term, grade) | |

**RLS (4.3/4.4):** any staff read/write at the RLS layer; which subjects a teacher
may configure is enforced in the server action (`results-scope.ts`).

### 4.5 `defaulter_records`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid FK→`students` NOT NULL | |
| `incident_date` | date NOT NULL | |
| `description` | text NOT NULL | |
| `action_taken` | text | |
| `recorded_by` | uuid FK→`staff` | |
| `created_at` | timestamptz NOT NULL | |

**RLS:** guardian reads own children's; staff full access.

### 4.6 `subjects` (0008)
`id` PK, `name` text NOT NULL UNIQUE, `created_at`. Seeded with a default list.
**RLS:** any authenticated reads; principal/super_admin manage.

### 4.7 `timetable_periods` (0008)
`id` PK, `position` int UNIQUE, `label`, `start_time`/`end_time` time, `is_break`
boolean, `created_at`. Break/lunch rows carry `is_break=true`. Seeded 8:30–16:00.
**RLS:** any authenticated reads; principal/super_admin manage.

### 4.8 `timetable_entries` (0008)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `class_section_id` | uuid FK→`class_sections` NOT NULL | on delete cascade |
| `day_of_week` | int NOT NULL | CHECK 1(Mon)–6(Sat) |
| `period_id` | uuid FK→`timetable_periods` NOT NULL | |
| `subject_id` | uuid FK→`subjects` | nullable (free slot) |
| `teacher_id` | uuid FK→`staff` | nullable |
| `updated_at` | timestamptz NOT NULL | |
| UNIQUE | (class_section_id, day_of_week, period_id) | one cell per slot |

**RLS:** staff read all; guardian reads own children's classes; principal/super_admin write.

### 4.9 `class_subject_teachers` (0025)
`id` PK; `class_section_id`, `subject_id`, `teacher_id` (all FK, cascade);
`created_at`; UNIQUE(class_section_id, subject_id, teacher_id). Source of truth for
"who teaches what," independent of the grid; feeds marks-edit scope.
**RLS:** staff read; principal-tier manage.

### 4.10 Homework family
| Table | Key columns | Purpose |
|-------|-------------|---------|
| `homework_assignments` (0020) | `class_section_id`, `subject_id`, `teacher_id`, `title`, `description`, `due_date` | The assignment. Guardian reads own class; staff full access. |
| `homework_submissions` (0034) | `homework_id`, `student_id`, UNIQUE(pair) | Per-student status override (see 0036 default-checked design). Staff manage. |
| `homework_notifications` (0037) | `homework_id`, `student_id`, `notified_at`, UNIQUE(pair) | Dedup ledger for the "not-done" push so a parent is notified once. Staff manage. |
| `homework_comments` (0047) | `homework_id`, `student_id`, `staff_id`, `comment`, UNIQUE(pair) | Per-student teacher remark. Staff manage; guardian reads own children's. |

### 4.11 `student_qr_codes` (0003)
`student_id` PK/FK (1:1), `token` uuid UNIQUE (opaque, rotatable), `issued_at`,
`issued_by`. The token is deliberately separate from `students.id` so a lost card
can be rotated. **RLS:** staff read (for scanning) + guardian reads own child's;
principal/super_admin write.

### 4.12 `competitions` (0021)
`id` PK, `name`, `description`, `exam_date`, `registration_deadline`,
`external_link`, `created_by`, `created_at`. Informational only.
**RLS:** any authenticated reads; principal/super_admin manage.

---

## 5. Workflow, communication & consent tables

### 5.1 `leave_requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid FK→`students` NOT NULL | |
| `requested_by` | uuid FK→`guardians` NOT NULL | |
| `from_date`,`to_date` | date NOT NULL | |
| `reason` | text NOT NULL | |
| `status` | `leave_status` NOT NULL default `pending` | |
| `decided_by` | uuid FK→`staff` | |
| `decided_at` | timestamptz | |
| `created_at` | timestamptz NOT NULL | |

**RLS:** guardian reads own children's; **guardian insert is `WITH CHECK`-bound**
to `requested_by = current_guardian_id()` AND an own child; staff decide (full).

### 5.2 `stay_back_consents`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid FK→`students` NOT NULL | |
| `raised_by_guardian_id` | uuid FK→`guardians` NOT NULL | |
| `teacher_id` | uuid FK→`staff` NOT NULL | the specific named teacher |
| `reason` | text NOT NULL | |
| `stay_date` | date NOT NULL | |
| `from_time`,`to_time` | time NOT NULL | |
| `status` | `stay_back_status` default `pending` | |
| `teacher_decision`/`teacher_decided_at` | approval_decision / ts | legacy 2-party columns |
| `principal_decision`/`principal_decided_at` | approval_decision / ts | legacy 2-party columns |
| `purpose` / `mode_of_transport` | (added 0011) | |
| `created_at` | timestamptz NOT NULL | |

The current approval flow uses the generic `approval_steps` chain (see 5.3), not
just the legacy two decision columns. **RLS:** guardian reads own children's;
guardian insert `WITH CHECK`-bound to own child; staff decide.

### 5.3 `approval_steps` (0010)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `subject_type` | `approval_subject_type` NOT NULL | stay_back_consent / ptm_slot_request |
| `subject_id` | uuid NOT NULL | polymorphic (not FK) |
| `step_order` | smallint NOT NULL | ordered |
| `approver_role` | `approval_step_role` NOT NULL | |
| `approver_staff_id` | uuid FK→`staff` | pre-assigned for named-teacher steps |
| `decision` | `approval_decision` | null = open |
| `decided_at` | timestamptz | |
| UNIQUE | (subject_type, subject_id, step_order) | |

Logic in `src/lib/approvals.ts`: any decline closes the subject; approved only when
every step is approved (`computeSubjectStatus`). **RLS:** staff manage; guardian
reads steps for subjects they own (subject-type-specific ownership path).

### 5.4 PTM family
| Table | Key columns | RLS |
|-------|-------------|-----|
| `ptm_meetings` (0006) | `class_section_id`, `teacher_id` (primary), `title`, `meeting_date`, `status` (open/closed), `assigned_admin_id` (0033) | guardian reads own children's classes; staff full |
| `ptm_meeting_teachers` (0033) | `meeting_id`, `teacher_id`, PK(pair) | staff read; principal-tier manage |
| `ptm_slots` (0001, +meeting_id 0006) | `teacher_id`, `class_section_id`, `meeting_id` NOT NULL, `starts_at`/`ends_at`, `booked_by_guardian_id`, `booked_student_id` | guardian reads class + books own; staff full |

### 5.5 `parent_consultations` (0044)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `student_id` | uuid FK→`students` NOT NULL | |
| `requested_by` | uuid FK→`guardians` NOT NULL | |
| `preferred_date` | date NOT NULL | **CHECK: dow ∈ {2,4}** (Tue/Thu) |
| `availability_note` | text NOT NULL | |
| `status` | `consultation_status` default `pending` | |
| `scheduled_time` | time | |
| `decided_by`/`decided_at`/`decision_note` | staff / ts / text | |

**RLS:** guardian reads own children's; guardian inserts for own child; guardian
may update **only to cancel** their own (`status='cancelled'`); staff manage.

### 5.6 Messaging family
| Table | Key columns | RLS summary |
|-------|-------------|-------------|
| `messages` (0001) | `subject`, `body`, `sender_id` FK→staff, `scope_type`, `urgent`, `scheduled_for`, `sent_at`, `created_at` | staff manage; guardians read messages resolved to them (via receipts/targets, 0002) |
| `message_targets` (0001) | `message_id`, nullable `class_section_id`/`student_id`/`custom_group_id` | staff write; guardian read of own targets (0002) |
| `message_attachments` (0001) | `message_id`, `file_name`, `storage_url` (Firebase), `size_bytes` | readable for messages the caller can see; staff write |
| `message_receipts` (0001) | `message_id`, `guardian_id`, `delivered_at`, `read_at`, PK(pair) | guardian reads/updates own receipts; staff write |
| `custom_groups` (0001) | `name`, `created_by` | staff |
| `custom_group_students` (0001) | `custom_group_id`, `student_id`, PK(pair) | staff |
| `custom_group_staff_access` (0023) | `custom_group_id`, `staff_id`, `granted_by`, PK(pair) | staff read own; principal-tier grant |
| `message_send_permissions` (0016) | PK(`role`, `scope_type`), `allowed` | authenticated read; principal/super_admin manage |

### 5.7 `reminders` (0018) — **DEPRECATED**
Owner-scoped reminders table. The reminders feature (parent nav, route, cron
dispatch) was removed (`FEATURES.md`, "Reminders tab removal"). The table and its
owner-RLS may still exist in the schema but is not exercised by current code. Do
not build on it without re-review.

### 5.8 Report-an-issue family
| Table | Key columns | RLS summary |
|-------|-------------|-------------|
| `reported_issues` (0019, redesigned 0039) | `reported_by_guardian_id` XOR `reported_by_staff_id`, `subject`, `body`, `audience` (0039), `status`, resolve fields | reporter reads own; principal-tier read all; front office reads `front_office_and_principal`; directed teacher reads via `current_staff_is_issue_recipient()`; visible staff resolve |
| `reported_issue_recipients` (0039) | `issue_id`, `staff_id`, PK(pair) | read if parent issue visible; reporter attaches recipients |

The 0019 `confidential` boolean was replaced by the `audience` enum + directed
recipients model in 0039.

---

## 6. Notifications, sync, ops & finance tables

### 6.1 `push_subscriptions` (0001)
`id` PK; `guardian_id` XOR `staff_id` (CHECK `num_nonnulls = 1`); `endpoint` text
UNIQUE (upsert key, uniqueness added 0005b); `p256dh`, `auth`; `created_at`.
**RLS (owner policy added 0050, F4):** a user manages only their own subscriptions.

### 6.2 `notification_preferences` (0015)
`id` PK; `guardian_id` XOR `staff_id`; `category` (`notification_category`);
`enabled` boolean default true; partial-unique on (owner, category). Absence of a
row = enabled. **RLS:** owner manages own. Upsert fix in 0048.

### 6.3 `notification_log` (0042)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `recipient_type` | text CHECK in (guardian, staff) | |
| `recipient_id` | uuid NOT NULL | |
| `category` | `notification_category` | |
| `title`,`body` | text NOT NULL | |
| `delivered` | boolean NOT NULL | whether a device was reachable |
| `sent_at` | timestamptz NOT NULL | |

Written only via the service-role client from `sendPush()`. **RLS:** principal-tier
read only (audit/proof log — NFR-2).

### 6.4 Sheet-sync family (0017)
| Table | Key columns | RLS |
|-------|-------------|-----|
| `sheet_sync_runs` | `started_at`, `finished_at`, `status`, `error_summary` | staff full access |
| `sheet_sync_pending_deletions` | `subject_type`, `subject_id`, `sheet_row_snapshot` (jsonb), `detected_at`, `resolved_at`, `resolved_by` | staff full access (the destructive *confirm* is super_admin-gated in the action layer) |

### 6.5 `storage_usage_snapshots` (0045)
`id` PK, `db_bytes` bigint, `file_bytes` bigint, `computed_at`, `computed_by`.
Cached storage-usage figure. **RLS:** principal-tier read + insert. Backed by
`database_size_bytes()` (SECURITY DEFINER) and `getBucketUsageBytes()`.

### 6.5a `audit_log` (0051)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `table_name` | text NOT NULL | e.g. `exam_results`, `attendance_records`, `students` |
| `record_id` | uuid | the affected row's id |
| `operation` | text NOT NULL | CHECK in (INSERT, UPDATE, DELETE, ERASE) |
| `actor_staff_id` | uuid | `current_staff_id()` at write time |
| `actor_auth_id` | uuid | `auth.uid()` at write time |
| `old_row` | jsonb | prior state (UPDATE/DELETE) |
| `new_row` | jsonb | new state (INSERT/UPDATE) or erase summary (ERASE) |
| `changed_at` | timestamptz NOT NULL | |

Versioned audit trail (DG-3). Written **only** by the `audit_row_change()` trigger
(on `exam_results` and `attendance_records`) and by `erase_student()`; there is no
INSERT/UPDATE/DELETE policy, so anon-key clients can never write or tamper. **RLS:**
principal-tier read only. Bounded by the 24-month retention prune.

### 6.6 `staff_reassignment_alerts` (0032)
`id` PK, `staff_id`, `message`, `resolved` boolean, `created_at`. Surfaces when a
staff reassignment leaves something dangling. **RLS:** principal-tier manage.

### 6.7 Finance: `invoices` / `payments` (0001)
| `invoices` | `id`, `student_id`, `fee_head`, `amount_paise` bigint, `due_date`, `status` (`invoice_status`), `created_at` |
| `payments` | `id`, `invoice_id`, `amount_paise` bigint, `gateway_reference`, `receipt_pdf_url` (Firebase), `paid_at` |

**RLS:** currently **deny-all** (RLS enabled, no read/write policies). This is safe
by design — there is no parent-facing payment path yet (finding F14, `SECURITY_AUDIT.md`).
A future parent read view must be added deliberately with a scoped policy.

### 6.8 Calendar: `dtr_events` / `dtr_event_classes` (0001)
| `dtr_events` | `id`, `title`, `event_date`, `category` (`dtr_category`), `description`, `created_by`, `created_at` |
| `dtr_event_classes` | `dtr_event_id`, `class_section_id`, PK(pair) — null join membership = whole-school event |

**RLS:** any authenticated reads; staff write.

---

## 7. Functions (stored procedures)

| Function | Security | Purpose |
|----------|----------|---------|
| `current_guardian_id()` | DEFINER | Resolve `auth.uid()` → guardian id. Backbone of guardian RLS. |
| `current_staff_id()` | DEFINER | Resolve `auth.uid()` → staff id. |
| `current_staff_role()` | DEFINER | Resolve signed-in staff role (0008). |
| `is_staff()` | DEFINER | True if the auth user is any staff. |
| `is_principal()` | DEFINER | True if principal/super_admin (0003). |
| `staff_can_edit_student_marks(uuid)` | DEFINER | Marks write-scope check (0050). |
| `current_staff_is_issue_recipient(uuid)` | DEFINER | Directed-issue visibility (0039). |
| `attendance_summary(uuid[])` | INVOKER, search_path pinned | Attendance aggregation (0005). |
| `enforce_guardian_valid()` / `enforce_link_valid()` | DEFINER (triggers) | Integrity rules: student ≥1 parent; guardian child-or-email (0040). |
| `create_student_with_guardians(...)` | INVOKER | Atomic add-student-with-parents (0040). |
| `replace_guardian_children(...)` | INVOKER | Atomic edit-parent's-children (0040). |
| `sync_upsert_guardian(...)` | INVOKER | Sheet-sync guardian upsert + relink in one tx (0040). |
| `database_size_bytes()` | DEFINER | DB size for storage snapshot (0045). |
| `audit_row_change()` | DEFINER (trigger) | Records marks/attendance edits into `audit_log` (0051). |
| `prune_old_records()` | DEFINER | Retention prune of append-only logs; run from cron (0052). `EXECUTE` granted only to `service_role`. |
| `erase_student(uuid)` | DEFINER | DPDP right-to-erasure across all tables + orphaned guardians; super-admin-gated, logs an ERASE row (0052). |

All SECURITY DEFINER functions have `search_path` pinned to `public` (verified;
finding F13). `EXECUTE` on the helper/definer functions is revoked from `anon`
(finding F12).

---

## 8. Constraints & invariants (summary)

| Invariant | Mechanism | Source |
|-----------|-----------|--------|
| One attendance record per student per day | UNIQUE(student_id, date) | 0001 |
| One timetable cell per class/day/period | UNIQUE(class_section_id, day_of_week, period_id) | 0008 |
| A student has ≥1 guardian | deferred constraint trigger + RPC | 0040 |
| A guardian has a child or an email | deferred constraint trigger | 0040 |
| Owner XOR on push/preferences/reminders | CHECK `num_nonnulls(...) = 1` | 0001/0015/0018 |
| Consultation date must be Tue/Thu | CHECK on `extract(dow ...)` | 0044 |
| One push subscription per endpoint | UNIQUE(endpoint) | 0005b |
| Approval steps ordered & unique | UNIQUE(subject_type, subject_id, step_order) | 0010 |
| Money as integer paise | `bigint` columns | 0001 |
