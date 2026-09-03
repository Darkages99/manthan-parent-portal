# 08 — Testing & Verification Plan

How correctness and security are proven and kept proven. This plan covers the test
strategy, the environment constraints unique to this repo, the concrete test suites
(static, RLS impersonation, E2E, integration, UAT), the per-module test matrix,
and the regression gate for future changes.

The security-specific verification (per-table RLS matrix, impersonation templates,
attacker-profile tests) is specified in full in `SECURITY_AUDIT.md` §5 and §8; this
document covers functional + non-functional testing and references that file for
the security portion rather than duplicating it.

---

## 1. Test strategy & levels

| Level | Purpose | Tooling | Where |
|-------|---------|---------|-------|
| L1 Static | Type safety, lint, dead code | `tsc --noEmit`, `eslint` | CI / local |
| L2 Unit | Pure logic (approval status, grade mapping, chain building, CSV escaping) | (to add) targeted unit tests | `src/lib/*` |
| L3 DB / RLS | Access-control correctness per table | Supabase SQL impersonation | Supabase MCP / SQL |
| L4 Integration | Actions/route handlers end-to-end incl. external side effects | manual + scripted | actions/routes |
| L5 E2E | User journeys in a browser | Playwright | `e2e/` |
| L6 UAT | Business acceptance per module | manual tracker | `FEATURES.md` |

---

## 2. Environment & verification constraints (this repo)

From project memory and `SECURITY_AUDIT.md` §1.3 — **read before running anything**:

- **`next build` fails offline** because Next fetches Google Fonts at build time.
  Do **not** treat a failed offline build as a code defect. Verify instead with:
  - `npx tsc --noEmit` (type check)
  - `npx eslint src` (lint; a known baseline of pre-existing lint noise exists)
- **DB / RLS changes** are applied via Supabase MCP `apply_migration` (project
  `symyylbkadpzzyncwjbd`) and verified by **impersonation** — the service-role MCP
  bypasses RLS, so tests **must** `set local role authenticated` and set JWT claims,
  otherwise the policy under test is not actually exercised.
- Deployment verification is done via Vercel (the owner verifies pushed changes on
  the live deployment).

---

## 3. L1 — Static analysis
```
npx tsc --noEmit        # must be clean for changed code
npx eslint src          # no new errors above the known baseline
```
Gate: no new type errors; no new lint errors introduced by a change.

---

## 4. L3 — RLS impersonation suite (the security-critical suite)

Method (per policy), from `SECURITY_AUDIT.md` §5:
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','<auth_user_id>','role','authenticated')::text, true);
-- positive: caller's own row  → expect rows
-- negative: another family / out-of-scope → expect 0 rows or error
<query>;
```
Coverage requirement: **every table** gets positive + negative tests as a guardian
and as each relevant staff role. Priority red-flags to re-verify after any change
(from the audit §5.1):

- `guardian_student` — a guardian cannot INSERT a link (no self-granting a child).
- `staff.role` — not self-updatable; super_admin creation is super_admin-only (F2).
- `exam_results` — a teacher cannot write an out-of-scope student's marks (F3);
  principal-tier still can.
- `leave_requests`, `stay_back_consents`, `parent_consultations` — inserts
  `WITH CHECK`-bound to own children even when the app code doesn't re-check.
- `push_subscriptions`, `notification_preferences` — owner-only.
- `reported_issues` — audience/directed visibility exactly as specified.
- `payments`/`invoices` — deny-all holds (no accidental read path).
- `notification_log`, `storage_usage_snapshots` — principal-tier read only.

These are the regression gate: **re-run after any RLS change.**

---

## 5. L4 — Integration tests (actions & route handlers)

For each of the 31 `actions.ts` files and 10 route handlers, verify the chain
(from `SECURITY_AUDIT.md` §6): authn → authz → input validation → RLS reliance /
re-authorization on admin-client sites → column allowlist → safe output → safe side
effects. Priority order: the 14 service-role sites first, then guardian-facing
actions, then principal-only actions, then route handlers.

Representative integration cases:
| Flow | Positive | Negative |
|------|----------|----------|
| `raiseStayBack` | own child → consent + chain + push | another family's child id → rejected by RLS `WITH CHECK` |
| `saveMarks` | own-class student → written | out-of-scope student → rejected by `staff_can_edit_student_marks` |
| attachment upload | owner of message → stored | non-owner / bad `messageId` → rejected |
| cron tick | correct Bearer → runs | missing/wrong/empty secret → 401 |
| sheet deletion confirm | super_admin → row deleted | principal → rejected |
| compose message | permitted role+scope → sent | teacher school-wide → blocked |

---

## 6. L5 — E2E (Playwright)

- Config: `playwright.config.ts`; current spec: `e2e/smoke.spec.ts`.
- **Extension plan** (from `SECURITY_AUDIT.md` §8): add cross-tenant journeys —
  guardian A attempting to view guardian B's child through the UI and by direct
  action invocation — plus the core happy paths per module.
- Seed data via the demo-seed scripts (`scripts/demo-seed/*`,
  `npm run demo:seed` / `demo:refresh-today` / `demo:add-test-account` /
  `demo:teardown`).

---

## 7. L6 — User Acceptance Testing (UAT)

The living UAT tracker is **`FEATURES.md`** at the repo root: every feature listed,
grouped by when it was last touched, with a status legend
(`[ ]` untested · `[x]` working · `[!]` issue). UAT is executed top-to-bottom
(most-recently-changed first). Sign-off = every relevant row `[x]`.

Per-module acceptance criteria map directly to the `FR-*` requirements in doc 01
and the module rules in doc 06. The traceability matrix (doc 11) links each
requirement to its module, source, RLS, and test.

---

## 8. Per-module test matrix (summary)

| Module | Static | RLS | Integration | E2E | UAT |
|--------|:-----:|:---:|:-----------:|:---:|:---:|
| Auth/session | ✓ | ✓ (staff/guardian resolve, inactive) | ✓ (activate) | ✓ (login) | ✓ |
| Attendance | ✓ | ✓ | ✓ | ✓ | ✓ |
| Results/report cards | ✓ | ✓ (marks scope) | ✓ (upload) | ✓ | ✓ |
| Homework | ✓ | ✓ | ✓ (notify) | ✓ | ✓ |
| Timetable | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leave | ✓ | ✓ (WITH CHECK) | ✓ | ✓ | ✓ |
| Stay-back | ✓ | ✓ | ✓ (chain) | ✓ | ✓ |
| PTM | ✓ | ✓ | ✓ (booking race, delete guard) | ✓ | ✓ |
| Consultations | ✓ | ✓ (Tue/Thu, cancel-only) | ✓ | ✓ | ✓ |
| Messaging | ✓ | ✓ (send perms, scope) | ✓ (recipients, attach) | ✓ | ✓ |
| Issues | ✓ | ✓ (audience/directed) | ✓ | ✓ | ✓ |
| Notifications | ✓ | ✓ (owner, log read) | ✓ (fan-out, prune) | — | ✓ |
| Sync | ✓ | ✓ (staff read, super-admin delete) | ✓ (sync run, pending deletions) | — | ✓ |
| Admin | ✓ | ✓ (staff mgmt split) | ✓ | ✓ | ✓ |

---

## 9. Non-functional test checks

| NFR | Check |
|-----|-------|
| NFR-1 Confidentiality | RLS suite (§4). |
| NFR-2 Auditability | Confirm a `notification_log` row per send; confirm a deletion cannot bypass the pending-deletion queue. |
| NFR-3 Integrity | Attempt: add student with no parent (rejected); remove a student's last parent (rejected); guardian with neither email nor child (rejected). |
| NFR-6 Headers | Inspect response headers for the six security headers. |
| NFR-10 Degradation | Unset VAPID/SMS/Sheets env → features no-op with a log, app still runs. |

---

## 10. Regression gate & change procedure

For any change:
1. `tsc --noEmit` + `eslint src` clean (L1).
2. If RLS/policies changed → re-run the impersonation suite for affected tables (L3)
   and the red-flag list (§4).
3. If an action/route changed → re-verify its authn→authz→validate chain (L4).
4. Update the affected compliance doc(s) and the traceability matrix (doc 11).
5. Update `FEATURES.md` status and re-run affected E2E/UAT.
6. Push; verify on the Vercel deployment.

The RLS impersonation queries + this document + `SECURITY_AUDIT.md` together are the
standing regression gate that keeps the posture verified over time.
