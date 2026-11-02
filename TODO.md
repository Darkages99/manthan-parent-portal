# Deployment-readiness TODO (persistent)

> **For Claude, at the start of every session:** read this file, then
> `compliance/12-deployment-readiness-plan.md` (the *why* and exit criteria). Work the
> first unchecked item in the lowest-numbered open phase unless the user directs
> otherwise. When an item is done and **verified** (command run, output seen), tick it,
> add the date and a one-line evidence note, and append to the Session log at the
> bottom. Never tick on belief. If an item turns out wrong or blocked, don't delete it:
> mark `[~]` (blocked) or `[-]` (dropped) and write why. Keep `compliance/` docs in
> step with any code change (CI will enforce this once WS-9 lands).
>
> Legend: `[ ]` open · `[x]` done+verified · `[~]` blocked/needs user · `[-]` dropped
>
> Next.js here has breaking changes: before touching Next APIs read
> `node_modules/next/dist/docs/` (see `AGENTS.md`).

## Fixed facts (decided 2026-11-01)
- Scale: 800 students, ~1,600 guardians, 100+ staff, ~2 sessions/day/parent.
- Target: self-hosted Supabase on school servers; **no third-party service trusted**
  (data + processing on school hardware; allow-listed outbound only).
- Google Sheets sync: keep for the cloud pilot only; self-hosted build uses in-app CSV/XLSX import.
- **Scope decision (user, 2026-11-01, later): hold off replacing third parties.** Make the system
  production-ready *with* the current vendors (Supabase cloud, Vercel, Firebase Storage, Google
  Sheets/OAuth, Google Fonts). Phase 4 (WS-7) waits until the school says which services it can
  accept. Item 1.6 is deferred for the same reason. Do not start Phase 4 unprompted.
- Baseline measured 2026-11-01: tsc clean · eslint 1 err/1 warn · 0 unit tests · 5 smoke e2e · no CI · `npm audit` 37 (1 critical `next`, 10 high) · all FEATURES.md rows untested.

## Open questions for the user (don't block on these; ask when an item needs them)
- [ ] Q1 Confirm "airgapped" definition (plan WS-7) — allow-listed outbound OK?
- [ ] Q2 Browser push: accept outbound to FCM/Mozilla/Apple, or drop push (in-app inbox + SMS relay)?
- [ ] Q3 Retention windows (24/24/12/12 months) acceptable?
- [ ] Q4 Independent reviewer + budget (WS-5.9)
- [ ] Q5 Pilot scope (which grades) and who signs acceptance
- [ ] Q6 RPO/RTO the school accepts (suggest lose ≤24 h, restore ≤4 h)
- [ ] Q7 Who operates the school servers? OS/hardware available?

---

## Phase 0 — Truth
- [x] P0.1 Re-verify compliance docs 00–11 against live DB + code (2026-11-01; doc 03/04/05/06/11 etc. corrected)
- [x] P0.2 Write deployment-readiness plan (`compliance/12-…`) (2026-11-01)
- [x] P0.3 Record decisions (scale, self-host, Sheets) in plan + this file (2026-11-01)
- [x] P0.4 Commit the doc work — 2026-11-01; user asked for it; committed in logical commits on `master` (not pushed)

## Phase 1 — Safety net (CI, unit tests, critical advisories)
### WS-1 Quality gate
- [x] 1.1a Fix lint error `src/components/theme-toggle.tsx` (set-state-in-effect) — 2026-11-01; now `useSyncExternalStore` over `<html data-theme>`
- [x] 1.1b Fix lint warning `src/components/results-view.tsx` (exhaustive-deps) — 2026-11-01; `results` memoised
- [x] 1.1c `npx eslint src` exits 0 with zero warnings — 2026-11-01; `npx eslint src test e2e --max-warnings 0` exit 0
- [x] 1.2a Add Vitest + config + `npm run test:unit` — 2026-11-01; Vitest 5.0.5, `vitest.config.mts`, 313 tests pass; mutation-checked (breaking `computeSubjectStatus` fails 3 tests)
- [x] 1.2b `.github/workflows/ci.yml`: tsc, eslint, unit, build, audit (omit dev, high), gitleaks — 2026-11-01; run 41322329156 on `master` @ 497cdd2: all 4 jobs green (first run's gitleaks false positive fixed via `.gitleaksignore`)
- [x] 1.3a PR template `.github/pull_request_template.md` (tests, docs, migration, RLS checklist) — 2026-11-01
- [x] 1.3b Branch protection on `master` — 2026-11-01, set via `gh api` at the user's request; read back: PR required (0 approvals, sole maintainer), 4 required checks (the job *names*: "Types, lint, unit tests, build", "E2E smoke (Playwright)", "Dependency audit (production, high+)", "Secret scan (gitleaks)"), enforce_admins on, no force-push/delete, conversations must be resolved. **All changes now go through a PR**; renaming a CI job requires updating the protection
- [x] 1.4 `.github/dependabot.yml` (npm + actions) — 2026-11-01 (weekly, minor+patch grouped); activates on push
- [x] 1.5a `CODEOWNERS`, `CONTRIBUTING.md`, `CHANGELOG.md` — 2026-11-01
- [x] 1.5b Tag `v0.2.0` after CI is green (also bump `package.json` version) — 2026-11-01; `package.json` 0.1.0 → 0.2.0 and CHANGELOG `[0.2.0]` section via the `release/v0.2.0` PR; annotated tag `v0.2.0` on that PR's merge commit, after `master` CI was green (PR #9 merged; run 41330724151 green on `dccfb9f`; tag pushed, `git ls-remote` shows `v0.2.0^{}` = `dccfb9f`)
- [~] 1.6 Make `next build` work offline: replace `next/font/google` with `next/font/local` (also WS-7 blocker) — DEFERRED by user 2026-11-01 (third-party replacement on hold)

### WS-5 (first slice) Critical/high advisories
- [x] 5.1a Read Next docs for 16.2→16.4 changes — 2026-11-01; snapshot-diffed bundled docs; proxy/route-handler/server-action/standalone docs: wording only, no breaking change
- [x] 5.1b Upgrade `next` + `eslint-config-next` to ≥16.4.3; tsc/lint/e2e/build pass — 2026-11-01; both pinned 16.4.3; tsc, eslint, build exit 0, 5/5 e2e pass
- [x] 5.1c Resolve `firebase` / `firebase-admin` high advisories (verify upload + push after) — 2026-11-01; `firebase-admin@14.5.0`; unused client `firebase` removed. **Upload against live Firebase NOT exercised** (no creds in session) — do a manual attachment upload after deploy
- [x] 5.1d `postcss`, `sharp`, `zod`, `brace-expansion`, `@fastify/busboy`, `source-map-js` cleared (via `npm audit fix` where safe) — 2026-11-01; none appear in `npm audit --omit=dev`
- [x] 5.2 `npm audit --omit=dev --audit-level=high` = clean; accepted advisories documented with expiry — 2026-11-01; exit 0; 5 moderate prod advisories (glob/minimatch via googleapis) in `SECURITY_AUDIT.md`, review by 2027-02-01. Total 37 → 20 (all moderate)

### WS-2A Unit tests (target ≥80% lines on `src/lib/**`)
- [x] 2A.1 `approvals.ts` (computeSubjectStatus), `approval-match.ts` — 2026-11-01
- [x] 2A.2 `stay-back-chain.ts` (grade 7 vs 8 chain), `stay-back-transport.ts` — 2026-11-01
- [x] 2A.3 `leave-status.ts` (expired) + extract/test the 3-day leave rule — 2026-11-01; rule now `leaveNeedsPrincipalApproval`, used by the action and the UI
- [x] 2A.4 `grade-boundaries.ts`, `grades.ts`, `results-analytics.ts`, `results-scope.ts` — 2026-11-01
- [x] 2A.5 `teacher-scope.ts`, `roles.ts` — 2026-11-01
- [x] 2A.6 `csv.ts` (formula-injection prefixes) — 2026-11-01
- [x] 2A.7 `date-range.ts`, `format.ts`, `calendar.ts`, `timetable.ts`, `dtr.ts` — 2026-11-01; date-range tested under 4 host time zones, old code fails 12 of them
- [x] 2A.8 `attendance*.ts`, `alerts.ts`, `console-alerts.ts`, `staff-alerts.ts` — 2026-11-01
- [x] 2A.9 PTM slot generation + default slot length by grade (extract pure fn) — 2026-11-01; `src/lib/ptm-slots.ts`
- [x] 2A.10 Coverage report published by CI; threshold enforced — 2026-11-01; CI uploads `coverage/`; `src/lib` now 95.04% lines / 84.45% branches (365 tests); ratchet raised to 95/94/92/84. Uncovered remainder: thin Supabase/Firebase/QR wrappers

### Dead code / legacy (WS-4, can run in Phase 1)
- [x] 4.1 Migration dropping `reminders` table — 2026-11-01, user go-ahead; `0053_retire_legacy_schema.sql`. Live check first: 0 rows, no FKs in, no function refs. Dry-run in `begin…rollback` on live, then applied; `to_regclass('public.reminders')` = null. Types updated by hand (only that block)
- [x] 4.2 Retire `ptm_slot_request` and `admin` — 2026-11-01, same migration. **Retired, not removed from the enums**: `role` is the return type of `current_staff_role()` used by 21 policies, so a type rebuild on live with no replay env was too risky. Instead: 4 `admin` rows in `message_send_permissions` deleted, 3 policies rewritten without the values, CHECK constraints on `staff`, `message_send_permissions`, `approval_steps`. Verified on live: 0 policies reference either value, 3 constraints present, dry run proved an `admin` insert is rejected. Full enum removal → after 3.1b (rehearse locally). `erase_student` still mentions `ptm_slot_request` (harmless no-op)
- [x] 4.3 Dead-export scan (`knip`), delete unused code — 2026-11-01; earlier: removed `approval-checklist.tsx`, `class-teacher-assigner.tsx`, client `firebase` SDK + `lib/firebase/storage.ts`. Now: deleted `TrendLine`, `SidebarIcon`, `PeriodEditor` wrapper; un-exported 18 file-local names. `knip@6.44.1` pinned, `npm run knip` exit 0, step added to CI `verify` job. Exceptions in `knip.jsonc`: `public/**` (loaded by URL), generated `database.types.ts`, `timetable-csv-import.tsx`; `importTimetableCsv` tagged `@public` (both kept for 7.3)
- [x] 4.4 Lint rule forbidding `any` / `@ts-ignore`; suppressions count = 0 — 2026-11-01; `any`/`@ts-ignore` blocked by eslint-config-next/typescript. The 4 suppressions are gone: combobox + attendance-analytics list real deps behind a run-once ref; `selected-child-context` uses `useSyncExternalStore` (new `selected-child-context.test.tsx`, 5 tests on happy-dom; 3 mutations each fail ≥1 test). `noInlineConfig` in `eslint.config.mjs`: a probe file with `eslint-disable-next-line` made `eslint --max-warnings 0` exit 1

### Found during Phase 1 (2026-11-01)
Fixed, each with a test that fails on the old code:
- [x] F-A `console-alerts.ts` "homework due today" was inverted (blamed students who had done it). Fixed; matches homework page + `homework-notify.ts`
- [x] F-B `date-range.ts` off by one day on IST hosts (UTC hosts fine). Would have bitten the self-hosted build. Fixed
- [x] F-C `sms.ts` logged guardian phone + message text with no relay configured (DG-4). Fixed
- [x] F-D `push.ts` put every recipient id in one query URL; a 1,600-guardian broadcast would fail and notify nobody. Now chunked by 100
- [x] F-E `createSlots` could loop forever for a window ending after ~23:45. Pure numeric `generateSlotWindows`
- [x] F-F `.env.example` was never committed (`.env*` ignore rule). Un-ignored; it is now committed
Open, need a decision or more work:
- [x] G-1 `google-sheets.ts`: a row WITH an id that failed validation or its DB write was queued as a pending deletion — 2026-11-01; confirmed in all 6 tabs (9 tests fail on the old code). Fix: the id counts as seen as soon as it is read. Docs 04 + 07 updated
- [x] 2A.11 Test `google-sheets.ts` — 2026-11-01; `src/lib/google-sheets.test.ts`, 52 tests, own stateful DB + Sheets fakes (the shared fake is read-only). File at 98.87% lines. Mutation check: removing the Students "seed only if empty" guard fails 7 tests
- [ ] N-1 Dockerfile uses `node:20-alpine` (Node 20 is end-of-life since Apr 2026). Bump to 24 and rebuild when Docker is available (3.3). Docker is not installed on this machine, so untested
- [x] N-2 Pass mark — 2026-11-01; user decided **40% is a pass**. `console-alerts.ts` now uses `FAIL_THRESHOLD_PCT` from `results-analytics.ts` (integer compare); its test fails on the old code (2 tests)
- [ ] N-3 `sendPush` fans out with unbounded `Promise.all` over every device (~3,000 for a full broadcast). Measure in the load test (8.1); add a concurrency cap if needed
- [ ] N-4 `csv.ts` prefixes any cell starting with `-` (so negative numbers export as text) and `parseCsv` does not strip the `'` it adds on re-import. Check whether any export is re-imported before changing
- [ ] N-5 npm warns 3 packages have install scripts not covered by `allowScripts` (sharp, protobufjs, unrs-resolver). Build and e2e pass; confirm `next/image` works in the Docker build (3.3)

## Phase 2 — Proof (RLS, actions, E2E, reproducibility, docs-as-tested)
### WS-3 Reproducible environments
- [x] 3.1a `supabase init`, commit `supabase/config.toml` — 2026-11-01; CLI 2.121.0, Postgres 17 (= live), `project_id = "manthan-parent-portal"`
- [x] 3.1b `supabase start` + `db reset` replays `0001…0053` + `seed.sql` from empty with no errors — 2026-11-01; **verified in CI, not locally** (no Docker on this machine). Run 41332869742: `db start` and `db reset` both exit 0; 54 files = 54 rows in `schema_migrations`; seed counts 2 students / 16 slots / 1 booked / 1 group member. Fixes needed: (a) two files shared version `0005` and `0005_push_subscriptions_endpoint_unique` re-added a constraint 0001 already creates → renamed to its live version `20260801170328_…` and guarded; (b) `0030` inserted the owner's staff row for a live-only auth user → guarded with `exists (auth.users)`; (c) `seed.sql` assumed a base seed and pre-dated `ptm_slots.meeting_id` → now self-contained (placeholder names). Live unaffected by (a)/(b)
- [x] 3.1c CI job "migrations replay" — 2026-11-01; job `Migrations replay (local Supabase)` (`supabase/setup-cli` pinned by SHA). Required check on `master` since 2026-11-02 (added via `gh api` at the user's request; protection now lists 5 contexts)
- [x] 3.2 Drift check: fresh replay vs live project via `supabase db diff` is empty (resolve file-vs-live migration naming mismatch; add baseline migration if needed). Known 2026-11-01: live has 56 timestamp versions; `0001` = live `init_schema` + `rls_policies` + `lock_down_helper_functions`; `attendance_summary_fn` (file 0005) was applied on live after `admin_role_permission_seed`. Needs the live DB password or a linked CLI in CI for `db diff --linked` — DONE 2026-11-02: migration 0054 (PR #15) applied to live as `20261102131746 access_rules` after a rolled-back rehearsal; drift run 41452309213 on `phase2/access-rules`: "No schema changes found". Pre-apply data snapshot kept for rollback.
- [ ] 3.3 `docker-compose.yml` (app + local Supabase) and README "first 15 minutes"
- [ ] 3.4 `src/lib/env.ts` boot-time env validation; `.env.example` exhaustive
- [ ] 3.5 Staging environment (separate Supabase/Firebase/host) + promotion path documented
- [ ] 3.6 Move secret JSONs out of repo dir; rotate Google OAuth client secret + service-account keys if ever shared (user action)

### WS-2B RLS as code (one file per table; guardian-own ✅/other ❌, each staff role, anon ❌)
- [x] 2B.0 Harness (pgTAP or Node runner; transaction + `set local role authenticated` + JWT claims + rollback) runs in CI — 2026-11-02, PR #12: pgTAP via `supabase test db` as a step of the required "Migrations replay" job. `supabase/tests/000_harness.sql` = 10 fixture users (guardian_a/b in separate families, teacher_8b/5a, principal, coordinator, front_office, accounts, super_admin, stranger) + `tests.authenticate_as/authenticate_anon/visible/affected`; `001_harness_selftest.sql` 13 asserts (auth.uid()/role resolution, per-family filtering, refused INSERT, 0-row UPDATE, no leak after rollback). CI run 41429198466: Files=2, Tests=14, PASS. Anon is counted as denied whether by GRANT or RLS.
- [ ] 2B.1 Identity: `staff`, `staff_directory`, `guardians`, `guardian_student`, `students`, `class_sections`
- [ ] 2B.2 Academic: `attendance_records`, `exam_results` (marks scope), `subject_grading_config`, `grade_boundaries`, `defaulter_records`
- [ ] 2B.3 Timetable/homework: `subjects`, `timetable_*`, `class_subject_teachers`, `homework_*`
- [ ] 2B.4 Requests: `leave_requests`, `stay_back_consents`, `approval_steps`, `parent_consultations`
- [ ] 2B.5 PTM: `ptm_meetings`, `ptm_slots` (open-only booking, own-booking cancel)
- [ ] 2B.6 Messaging: `messages`, `message_*`, `custom_group*`, `message_send_permissions`
- [ ] 2B.7 Issues: `reported_issues`, `reported_issue_recipients` (audience/directed)
- [ ] 2B.8 Ops: `push_subscriptions`, `notification_preferences`, `notification_log`, `storage_usage_snapshots`, `audit_log`, `sheet_sync_*`, `staff_reassignment_alerts`, `student_qr_codes`, `dtr_*`, `competitions`
- [ ] 2B.9 Finance deny-all: `invoices`, `payments`
- [ ] 2B.10 Functions: `staff_can_edit_student_marks`, `erase_student` (super_admin only, completeness), `prune_old_records` (service_role only), audit trigger fires
- [ ] 2B.11 Red-flag list from doc 08 §4 all covered

### WS-2C Server-action integration tests (local Supabase)
- [ ] 2C.1 `bookSlot` race: two parallel claims → exactly one wins
- [ ] 2C.2 `deleteMeeting` cascade + cancellation push to booked guardians
- [ ] 2C.3 `decideLeave` 3-day rule; `sendLeaveMessage`
- [ ] 2C.4 Stay-back: chain build, decide order, decline closes
- [ ] 2C.5 `saveMarks` scope; grade auto-fill
- [ ] 2C.6 Attachment upload ownership/UUID/basename; report-card upload + zip-slip
- [ ] 2C.7 Cron auth: missing/empty/wrong credential → 401; correct → runs 3 jobs
- [ ] 2C.8 `eraseStudent` end-to-end; `prune_old_records` windows
- [ ] 2C.9 Staff management: principal cannot create/modify super_admin

### WS-2D Authenticated E2E (Playwright)
- [ ] 2D.0 Seeded fixed users per role + auth storage-state helper
- [ ] 2D.1 Parent journeys: attendance, results, homework, timetable, raise leave, book/cancel PTM, consultation, stay-back, report issue, messages read
- [ ] 2D.2 Staff journeys per role: attendance, marks entry, homework, leave approve, stay-back decide, PTM create/delete, compose message
- [ ] 2D.3 Cross-family isolation via UI and direct action call
- [ ] 2D.4 Console role gating
- [ ] 2D.5 Playwright runs in CI; traces/videos kept as artifacts
- [ ] 2D.6 Doc 11 regenerated so every FR-* cites a test file

### WS-9 Docs that can't rot
- [ ] 9.1 `scripts/docs-check.mjs`: referenced paths exist; migration range = `ls`; table count; every FR in doc 01 has a doc 11 row; every doc 11 row names a test file
- [ ] 9.2 Wire docs-check into CI
- [ ] 9.3 Draft privacy notice + DPIA + records of processing + data-subject-request procedure
- [ ] 9.4 Known-limitations register

## Phase 3 — Operate (security closure, observability, load)
### WS-5 remainder
- [ ] 5.3 Rate limiting: activation, OTP/login-adjacent, exports, uploads
- [ ] 5.4 Real CSP with nonce-based `script-src`
- [ ] 5.5 Leaked-password protection (F11 — user toggles in dashboard / self-host config); decide F5 magic-link
- [ ] 5.6 Clear Supabase security + performance advisors; commit report
- [ ] 5.7 CodeQL/Semgrep in CI
- [ ] 5.8 Re-run `SECURITY_AUDIT.md`; every finding has a regression test; update audit
- [ ] 5.9 Independent security review commissioned and signed (needs Q4)
- [ ] 5.10 ADR: Firebase/Storage token URLs vs signed URLs
### WS-6 Operability
- [ ] 6.1 `GET /api/health` (app + DB)
- [ ] 6.2 Error tracking with PII scrubbing (self-hosted GlitchTip or equivalent)
- [ ] 6.3 Structured JSON logs + request ids
- [ ] 6.4 Uptime monitoring + alert route to a named person
- [ ] 6.5 Backup/restore drill on staging; record timings; set RPO/RTO (needs Q6)
- [ ] 6.6 Release rollback procedure + forward-only migration policy
- [ ] 6.7 Tabletop incident exercise (leaked key, bad deploy, DB restore)
### WS-8 Non-functional (basis: 800 students / ~1,600 guardians / 100+ staff)
- [ ] 8.1 k6 load test at 500 concurrent VUs: p95 reads <800 ms, errors <0.1%, 1,600-recipient broadcast queued ≤60 s
- [ ] 8.2 Slow-query/index review; fix N+1
- [ ] 8.3 Accessibility (axe/Lighthouse) on main parent screens; PWA install on low-end Android + iOS 16.4+
- [ ] 8.4 Record browser/device matrix actually tested

## Phase 4 — Portable & airgapped (WS-7)
- [ ] 7.1 Storage interface (`put/get/delete/list/signedUrl`) + Firebase adapter (refactor `src/lib/firebase/*`)
- [ ] 7.2 Self-hosted Storage adapter (Supabase Storage or S3-compatible/MinIO); object migration script
- [ ] 7.3 Roster import: in-app CSV/XLSX import with same tab contract + pending-deletion safety; feature flag to disable Sheets sync
- [ ] 7.4 Disable Google OAuth + Google Sheets via config; landing page hides them
- [ ] 7.5 Auth with no external provider: email/password via school SMTP; phone OTP via school SMS relay or disabled — verify each login path offline
- [ ] 7.6 Cron via system timer / sidecar hitting `/api/cron/tick`
- [ ] 7.7 Self-hosted Supabase compose stack + app container; internal CA/TLS; reverse proxy (Caddy/Nginx)
- [ ] 7.8 Data-migration runbook (Supabase cloud → self-host; objects; DNS cut-over; rollback)
- [ ] 7.9a Build image in connected CI; offline signed bundle (image + SBOM); vendored base images
- [ ] 7.9b Internal NTP; self-hosted monitoring (Uptime Kuma, Prometheus/Grafana)
- [ ] 7.9c Offline update + rollback procedure
- [ ] 7.9d Network allow-list documented; run full E2E with outbound firewall set to deny-all
- [ ] 7.10 Sizing guide (start: 4 vCPU / 16 GB / SSD + backup host), network diagram, TLS/firewall requirements
- [ ] 7.11 Browser-push decision implemented (needs Q2)

## Phase 5 — Acceptance
- [ ] 10.1 Execute `FEATURES.md` top to bottom; each row `[x]`/`[!]` with date+tester; rewrite so rows name their automated test
- [ ] 10.2 Fix every `[!]`
- [ ] 10.3 Pilot one grade; triage feedback (seed: `User Reviews.md`) (needs Q5)
- [ ] 10.4 Principal written sign-off
- [ ] 10.5 Assemble evidence pack (plan §5, items 1–11) in one folder

---

## Session log (append newest at bottom)
- 2026-11-01 — Docs re-verified vs live DB + code; plan written; decisions recorded; this TODO created. Nothing committed.
- 2026-11-01 (Phase 1 session) — User put third-party replacement on hold; Phase 4 deferred. Done: lint clean; Vitest + 313 tests (src/lib 58.99% lines); CI workflow, PR template, Dependabot, CODEOWNERS, CONTRIBUTING, CHANGELOG written; `next` 16.4.3; prod audit 0 critical/high; unused client Firebase SDK removed; 6 defects found by the tests and fixed (F-A…F-F). NOT done: CI never run on GitHub (nothing pushed), branch protection (user), tag, 2A.10 (58.99% < 80%), WS-4 items 4.1/4.2 (destructive migrations — need user go-ahead). Nothing committed. Next: 2A.11 (google-sheets tests), then Phase 2.
- 2026-11-01 (commit session) — Tree verified first (tsc 0, eslint 0 warnings, 313/313 tests), then committed in 12 logical commits on `master`; NOT pushed. Left uncommitted on purpose: `User Reviews.md` (names 23 real parents — user decides whether it belongs in the repo) and the modified `Teacher-parent portal clarification.docx` (not mine, 0-line diff). Waiting on the user: push, first green CI run (1.2b), branch protection (1.3b), then tag (1.5b).
- 2026-11-01 (CI triage) — First CI run: 3/4 jobs green. gitleaks false positive on TODO.md prose (reworded, fingerprint in `.gitleaksignore`). Dependabot TS 7.0.2 PR fails: typescript-eslint does not support TS 7 → major `typescript` bumps now ignored in dependabot.yml (close that PR). `User Reviews.md` and the `.docx` are now git-ignored; the docx was untracked with `git rm --cached` (file kept on disk, still in history).
- 2026-11-01 (2A.11 session) — CI fully green on `master` (1.2b). Branch protection applied via `gh api` (1.3b); from now on work happens on branches + PRs. N-2 fixed (40% passes). 2A.11 done: 52 Sheets-sync tests; they exposed G-1 in all 6 tabs, now fixed. `src/lib` coverage 59% → 95% (2A.10 closed). tsc 0, eslint 0, 365/365 tests locally. Work on branch `phase1/sheets-tests-pass-mark` → PR. Next: merge PR, tag v0.2.0 (1.5b), then WS-4 leftovers (4.3/4.4) or start Phase 2 (3.1a `supabase init`). Still need user go-ahead for 4.1/4.2. Open Dependabot PR #5 (googleapis 188, CI green) awaits review. Lesson: Windows PowerShell 5.1 `Get-Content`/`Set-Content` mangles UTF-8 (adds BOM, breaks `—`); don't round-trip source files through it.
- 2026-11-01 (WS-4 session) — PR #7 merged. User approved 4.1/4.2: migration 0053 dry-run on live in a rolled-back transaction, then applied to production and verified (details on 4.1/4.2). Enum values retired by CHECK, not removed (21 dependent policies; rehearse full removal after 3.1b). App: report-issue no longer looks up `admin` staff; dead demo-seed cleanup step removed. Docs 00/02/03/10/12/README updated. tsc 0, eslint 0, 365/365. Branch `phase1/retire-legacy-schema` → PR. Next: tag v0.2.0 (1.5b), then 4.3/4.4 or Phase 2 (3.1a).
- 2026-11-01 (release session) — PR #8 merged; `master` CI green @ e10d45a. Opened PR #9 (`release/v0.2.0`): version 0.2.0, CHANGELOG `[0.2.0]`, 1.5b ticked. Waiting on the user to merge #9; then tag `v0.2.0` on the merge commit and push it. Next: 4.3/4.4 leftovers or Phase 2 (3.1a `supabase init`).
- 2026-11-01 (cleanup + Phase 2 start) — PR #9 merged; `master` CI green on `dccfb9f`; annotated tag `v0.2.0` pushed (1.5b now true). PR #10 (`phase1/cleanup-exports-lint`, CI green, awaiting merge): 4.3 + 4.4 done, knip in CI, `noInlineConfig`, happy-dom component test for the child switcher. PR #11 (`phase2/migrations-replay`): 3.1a/b/c done, replay proven in CI (no local Docker). Two applied migrations got live-neutral guards; CONTRIBUTING now states that exception. PR #10 and #11 both touch TODO/CHANGELOG/ci.yml, so the second to merge needs a rebase. Next: user adds "Migrations replay (local Supabase)" to required checks; 3.2 drift check (needs DB password / linked CLI as a CI secret); then 2B.0 RLS harness on the local stack; enum removal of `admin`/`ptm_slot_request` can now be rehearsed in CI.
- 2026-11-02 — PR #11 merged. PR #10 rebased onto it (CHANGELOG conflict merged by hand). "Migrations replay (local Supabase)" added to `master` required checks. User installed Supabase CLI 2.122.0 locally, but there is still no Docker, so local replay stays in CI. 3.2 is waiting on the user for two CI secrets (Supabase access token and DB password).
- 2026-11-02 (2B.0) — PR #10 merged by user. PR #12 (`phase2/rls-harness`, draft, CI green): 2B.0 done (pgTAP harness in the replay job, `npm run test:db`, knip ignores the `supabase` binary). Waiting on user for 3.2 secrets (SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD). Next: 2B.1 identity tables on the same fixtures.
- 2026-11-02 (3.2 access rules) — #12, #13, #14 merged. Drift check found live and the files differ on 48 policies plus PUBLIC function revokes. With the user, agreed the access rules (messages, classes, leave, stay-back chain: grades 1–7 end at coordinator, calendar group targeting, super admin everything; "admin" in their rules = front_office). PR #15 (`phase2/access-rules`, draft, CI green): migration 0054 + RLS suite 010 (64 assertions, all pass in replay) + app/doc changes. 3.2 stays unticked until the user approves applying 0054 to live and the drift check comes back empty. Next: apply 0054 to live (needs go-ahead), then the role cleanup PR (remove admin/parent/accounts; the 2 accounts staff become front_office), then 2B.1.
- 2026-11-02 (3.2 applied) — User approved. Snapshot of affected live data taken; 0054 rehearsed on live in a rolled-back transaction, then applied (`20261102131746 access_rules`). Verified on live: 0 open principal steps on grade 1-7 stay-backs, 16 still pending, anon blocked from helpers; real-account checks (class teacher sees only own class leave 2/63, front office 63 and can edit classes, accounts 0, a parent sees 1 child and exactly their 10 messages). Drift check empty → 3.2 ticked. PR #15 marked ready; waiting on user to merge. Next: role cleanup PR (admin/parent/accounts), then 2B.1.
