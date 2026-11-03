# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [Unreleased]

### Added
- `supabase/config.toml` and a CI job that rebuilds the database from every migration plus
  `seed.sql` on an empty Postgres, then checks every migration was recorded and the seed loaded.
- `knip` dead-code check (`npm run knip`), run in CI. Exceptions and their reasons live in
  `knip.jsonc`.
- Component tests: `happy-dom` (opt in per file). First one covers the parent portal's
  selected-child switcher, including storage that throws (private browsing).
- Schema drift workflow (weekly and on demand, never on PRs): replays the migration files
  into a shadow database, diffs live against it, and fails with the diff as an artifact.
- RLS test harness (pgTAP, `supabase/tests`, `npm run test:db`), run in the migrations
  replay job. Fixture users cover two families, every staff role and a signed-in user with
  no role. A self-test shows impersonation reaches `auth.uid()` and RLS keeps families apart.
- Calendar screen (`/console/calendar`): add, edit and delete events. Teachers can add
  events only for their own classes or groups; edits change details, not the audience.
- A new calendar event (today or later) sends a push to the guardians it is for, under a
  new `calendar` notification category (migration 0056) that parents can turn off.
- RLS tests for the academic tables (`supabase/tests/030_academic.sql`, 41 asserts):
  attendance, exam results, grading config, grade bands and defaulter records.

### Changed
- `seed.sql` is self-contained (creates its own placeholder staff, classes, students and
  guardian) and sets `meeting_id` on PTM slots.
- Two applied migrations now replay from empty without changing live: the push-endpoint
  constraint migration is guarded and renamed to its live version (it shared `0005`), and
  `0030` skips the owner's staff row when that auth user doesn't exist.
- ESLint rejects `eslint-disable` comments (`noInlineConfig`). The 4 that existed are gone:
  two mount-only effects now list their real dependencies behind a run-once ref, and the
  selected-child switcher reads localStorage through `useSyncExternalStore`, like the
  theme toggle, instead of setting state in an effect.

### Removed
- Staff roles `admin`, `parent` and `accounts` (migration 0055). The 2 accounts staff are
  now front office, which is the same job. The role pickers and the message-permissions
  grid show the five remaining roles.
- Unused code: `TrendLine` chart, `SidebarIcon`, the collapsible `PeriodEditor` wrapper
  (the timetable uses `PeriodEditorBody`), and `export` on 18 file-local names.

### Fixed
- Front office could press "Remove" on a report card and see it succeed while nothing
  changed (RLS doesn't let front office write exam results). Removal now goes through the
  service role after the same permission check as upload, and errors if nothing matched.

### Security
- `staff_directory` is read-only for signed-in users. Before 0055 any signed-in user,
  parents included, could edit staff names and roles through it.

## [0.2.0] - 2026-11-01

### Added
- CI (GitHub Actions): typecheck, lint, unit tests with coverage, build, Playwright smoke
  tests, production dependency audit, secret scan. Actions pinned by commit SHA.
- Vitest unit-test harness (`npm run test:unit`): 313 tests across `src/lib`; coverage
  ratchet in `vitest.config.mts`. Shared `test/fake-supabase.ts` for query-level tests.
- Pull-request template, Dependabot, CODEOWNERS, CONTRIBUTING.
- `src/lib/ptm-slots.ts`: PTM slot generation and the grade-based default slot length,
  extracted from `createSlots` and the create-meeting form so they can be tested.
- `leaveNeedsPrincipalApproval` in `src/lib/leave-status.ts`: the 3-day leave rule,
  previously duplicated in the approve action and the approval list.

- Unit tests for the Google Sheets sync (`src/lib/google-sheets.test.ts`, 52 tests) with an
  in-memory database and Sheets API fake. `src/lib` line coverage 59% → 95%; ratchet raised.

### Changed
- **Pass mark: exactly 40% is a pass everywhere.** The console low-score alert treated 40%
  as failing while results analytics treated it as a pass; both now use `FAIL_THRESHOLD_PCT`.
- Upgraded Next.js 16.2.12 → 16.4.3, which fixes a critical advisory.
- Cleared all high-severity production advisories. `npm audit --omit=dev --audit-level=high`
  now exits 0 (5 moderate remain, accepted with an expiry in `SECURITY_AUDIT.md`).
- `@types/node` 20 → 24 (Vitest 5 requires Node ≥ 22.12 for tooling).
- Push delivery looks recipients up in batches of 100. A school-wide broadcast previously
  put ~1,600 ids in one query string; the lookup would fail and nobody would be notified.
- `.env.example` is now tracked (the `.env*` ignore rule had been hiding it).

### Removed
- Migration `0053_retire_legacy_schema.sql` (applied to production 2026-11-01): dropped the
  empty, unused `reminders` table. Retired the `admin` role and the `ptm_slot_request` approval
  subject type: every use removed (4 `admin` send-permission rows, 3 RLS policies) and CHECK
  constraints stop them returning. Both values remain in their enums; see the migration header.
- Unused client-side Firebase SDK (`firebase` dependency, `src/lib/firebase/storage.ts`) and
  the three `NEXT_PUBLIC_FIREBASE_*` variables only it used. Server-side `firebase-admin`
  is unchanged.
- Two orphaned components: `approval-checklist.tsx`, `class-teacher-assigner.tsx`.

### Fixed
- **Sheets sync queued live rows for deletion**: a row with an id that failed validation
  (e.g. a blank phone) or whose database write failed was treated as missing from the sheet
  and queued in Pending Deletions. Affected all six tabs. A super admin still had to confirm,
  so nothing was deleted, but the queue was misleading.
- **Console "homework due today" alert was inverted**: it blamed students who had done the
  work and missed those who had not (it misread `homework_submissions` overrides). It now
  matches the homework page and the nightly notifier.
- **Date-range filters were off by one day on servers in IST** ("This month" started on the
  31st of the previous month, "This year" on 31 Dec). They were correct only on UTC hosts
  such as Vercel; this would have broken lists and CSV exports when self-hosted.
- SMS fallback no longer writes the guardian's phone number and the message text to the
  server log when no relay is configured (DG-4).
- PTM slot generation could loop forever for a window ending after ~23:45.
- Lint: theme toggle now subscribes to `<html data-theme>` instead of setting state in an
  effect; results view memoises its per-student result list.
- Sign-in smoke test matched an outdated form label and a duplicate "Password" match.
