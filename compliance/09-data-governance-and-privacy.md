# 09 — Data Governance & Privacy

Because this system holds the personal data of **minors** and their guardians, this
document catalogues what personal data is held, where it lives, who can see it, how
long it is kept, and the controls and residual considerations relevant to India's
**Digital Personal Data Protection Act, 2023 (DPDP)** and general good practice.

> This is an engineering compliance description, not legal advice. It gives the
> data-protection reviewer the facts needed to assess the system and the school's
> obligations.

---

## 1. Personal data inventory

| Data category | Where stored | Subject | Sensitivity |
|---------------|-------------|---------|-------------|
| Student name, roll no, class, photo URL | `students` | minor | High (minor PII) |
| Guardian name, relation, phone, email | `guardians` | adult | High |
| Guardian↔student linkage | `guardian_student` | both | High |
| Staff name, role, phone, email, username | `staff` | adult | Medium–High (login username) |
| Attendance records | `attendance_records` | minor | Medium |
| Exam marks & grades | `exam_results`, `grade_boundaries` | minor | High (academic) |
| Behavioural/defaulter records | `defaulter_records` | minor | **High (disciplinary)** |
| Homework status & teacher remarks | `homework_*` | minor | Medium |
| Leave / stay-back / consultation requests | `leave_requests`, `stay_back_consents`, `parent_consultations` | minor + guardian | Medium |
| Messages & attachments | `messages`, `message_*` | mixed | Medium |
| Issue reports (incl. confidential) | `reported_issues` | mixed | **High (may be sensitive complaints)** |
| Fee/invoice/payment records | `invoices`, `payments` | minor + guardian | High (financial) |
| Push subscriptions / device endpoints | `push_subscriptions` | device | Medium |
| Notification log (title/body/recipient) | `notification_log` | mixed | Medium |
| Report card / receipt PDFs, attachments | Firebase Storage | minor + guardian | High |
| Roster mirror (all of the above core PII) | Google Sheet | minor + guardian + staff | **High (external residency)** |

---

## 2. Data locations (residency)

| Location | Data | Notes |
|----------|------|-------|
| Supabase Postgres (managed) | all relational data + auth | primary store; RLS-protected |
| Firebase Cloud Storage | PDFs, attachments | access only via server-minted token URLs |
| Google Sheet + Drive | roster/academic PII | shared only with principal/super_admin (email on file). **A copy of core PII lives outside the primary DB.** |
| Vercel (hosting) | transient request/log data | logs may contain server-side error detail (see §6) |
| End-user devices | cached PWA data, push endpoint | standard browser storage |

**DG note (data minimization / residency):** the Google Sheet is a deliberate,
convenient management surface but it duplicates minor PII into a third-party
document. Governance recommendation: restrict sheet sharing to the minimum staff,
keep it in a school-controlled Google Workspace, and include it in retention/
deletion procedures (§4).

---

## 3. Access & purpose limitation (`DG-ACCESS`)

Access is enforced by RLS (doc 05) and summarized per role in doc 05 §5. Principles
in force:
- **Least privilege / need to know:** parents see only their own children; teachers
  see operational data and write only within their teaching scope; sensitive logs
  (notifications, storage) and confidential issues are principal-tier only.
- **Purpose limitation:** each table serves a stated feature; no table aggregates
  data beyond its purpose. Staff directory PII is not exposed to parents (only a
  name/role view) since F1.
- **Separation of destructive authority:** roster deletion requires super-admin
  confirmation; role elevation to super_admin is super-admin-only.

---

## 4. Retention & deletion (`DG-RETENTION`)

Current behaviour and the governance position:

| Concern | Current mechanism | Governance action |
|---------|-------------------|-------------------|
| Roster deletion | Missing-from-sheet rows are **queued**, not auto-deleted; super_admin confirms | Define a policy for when confirmed deletions occur (e.g. after year-end). |
| **Automated retention** | ✅ **Implemented** — `prune_old_records()` (migration `0052`) runs daily from the cron tick and prunes append-only logs past their window: `notification_log` 24 months, `audit_log` 24 months, `sheet_sync_runs` 12 months, resolved `sheet_sync_pending_deletions` 12 months. Windows are defined in the function; change them there to change policy. | School owns the retention numbers — confirm/adjust the windows. |
| **Right to erasure (DPDP)** | ✅ **Implemented** — `erase_student(uuid)` (migration `0052`) removes a student and *all* dependent records across every table in FK-safe order, plus any guardian orphaned by the deletion, in one transaction; the `eraseStudent` server action then deletes the associated Firebase Storage objects and Supabase Auth users. Super-admin only; logged as an `ERASE` row in `audit_log`. Exposed as "Erase all data" in the Students console (super-admin only). | Operate per an approved erasure-request procedure; verify the two-step confirmation. |
| Cascade on delete | Verified: the erasure function handles the mix of CASCADE and NO ACTION FKs; the deferred integrity triggers (0040) still hold at commit (verified by impersonation, doc 08). | — |
| Storage growth | `storage_usage_snapshots` (DB + file usage) + the retention prune above | Periodic archive-and-reset incl. the Sheet copy (DG-2). |
| Backups | See doc 10 | Ensure backups are also within retention/erasure scope. |

Retention is now **automated** (daily cron) and erasure is a **one-click,
audited, super-admin action**. The residual governance action is choosing the
retention *windows* — the mechanism no longer requires manual work.

---

## 5. Consent & lawful basis (context)

- The school is the data fiduciary; parents/guardians are the data principals for
  their children (minors), consistent with DPDP's treatment of children's data
  (processing on behalf of a minor requires verifiable parental consent).
- Notification opt-out is supported per category (`notification_preferences`);
  absence of a row means enabled by default — the reviewer should confirm this
  default aligns with the school's consent posture for each channel.
- Activation requires proof of ownership (phone match) before an account is usable.

---

## 6. Confidentiality & information-disclosure controls

- Client-facing errors are generic; detailed errors are logged server-side only
  (doc 05 §; `SECURITY_AUDIT.md` §4.13). Server logs are now **scrubbed of PII**:
  all logging goes through `logError()` (`src/lib/log.ts`), which records a stable
  tag plus a non-sensitive error *code/name* only — never message bodies, names,
  emails, phone numbers, or other user free-text (DG-4). **Residual governance
  action:** ensure the Vercel log store itself has appropriate access controls and
  retention.
- No secret or PII is shipped to the browser beyond what a user is authorized to
  see; only intended public config carries `NEXT_PUBLIC_`.
- Confidential issue reports are visible only to principal-tier (and any directed
  teacher), never to all staff.
- Notification log is an **auditability asset** (prove a parent was notified) but is
  itself PII — hence principal-tier read-only.

---

## 7. Auditability (`DG-AUDIT`)

| Audit capability | Source |
|------------------|--------|
| Proof a parent/staff member was notified of X at time Y | `notification_log` (every `sendPush` logs one row per target with a `delivered` flag) |
| History of roster sync runs incl. failures | `sheet_sync_runs` |
| Record of what disappeared from the roster and when | `sheet_sync_pending_deletions` (snapshot + `detected_at`) |
| Who decided a request and when | `decided_by`/`decided_at` on leave/consultation; `approval_steps.decided_at` |
| Who recorded a defaulter / issued a QR / uploaded | `recorded_by`, `issued_by`, `created_by` columns |
| Storage-usage snapshots over time | `storage_usage_snapshots` |
| **Full edit history of marks & attendance** | ✅ `audit_log` (migration `0051`) — a trigger records every INSERT/UPDATE/DELETE on `exam_results` and `attendance_records` with actor (staff id + auth uid), timestamp, and full old/new row JSON. Principal-tier read-only. |
| **Erasure events** | `audit_log` `ERASE` rows (who erased which student, when, and what files/accounts were removed). |

Core academic records are now **versioned**: `audit_log` (DG-3) captures the full
history of every mark and attendance change, so an edited mark's prior values are
recoverable and attributable. The append-only `audit_log` is itself bounded by the
retention prune (24 months) so it cannot grow without limit.

---

## 8. Governance summary — controls vs. gaps

**In place:**
- DB-enforced least-privilege access (RLS) for all data (NFR-1).
- No cross-family leakage; parents cannot self-link children.
- Proof-of-notification logging (NFR-2).
- Non-destructive roster sync with explicit deletion confirmation (NFR-2).
- Data-integrity invariants (NFR-3).
- No secrets/PII in the client bundle or git history.
- **Automated retention** of append-only logs (`prune_old_records`, migration 0052).
- **One-click, audited, super-admin right-to-erasure** across Postgres + Firebase +
  Auth (`erase_student` + `eraseStudent`, migration 0052).
- **Versioned audit trail** for marks & attendance (`audit_log`, migration 0051).
- **PII-scrubbed server logs** (`logError`, `src/lib/log.ts`).

**Gap status (updated after the 2026-09-03 governance remediation):**
- **DG-1** — ✅ **Closed.** Automated retention + right-to-erasure implemented
  (migration 0052). *Residual owner task:* confirm the retention windows.
- **DG-2** — 🟡 **Mitigated.** The Google Sheet is shared only with
  principal/super_admin staff who have an email on file (`provisionSheet`), i.e.
  minimal sharing. The architectural duplication of PII into an external document
  remains by design; include the Sheet in the archive/erasure procedure.
- **DG-3** — ✅ **Closed.** `audit_log` versions all marks & attendance edits
  (migration 0051).
- **DG-4** — ✅ **Closed (app side).** Logs scrubbed of PII via `logError`.
  *Residual owner task:* access-control/retention on the Vercel log store itself.
- **DG-5** — ✅ **Decided.** The school elects to keep **opt-out** (notifications
  default-on, users disable per category). Recorded here as the consent posture;
  no code change. Revisit if a stricter consent-first reading is required.
- Plus the security owner-actions carried in `SECURITY_AUDIT.md` (F5/F9/F11).
