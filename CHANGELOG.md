# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [Unreleased]

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

### Changed
- Upgraded Next.js 16.2.12 → 16.4.3, which fixes a critical advisory.
- Cleared all high-severity production advisories. `npm audit --omit=dev --audit-level=high`
  now exits 0 (5 moderate remain, accepted with an expiry in `SECURITY_AUDIT.md`).
- `@types/node` 20 → 24 (Vitest 5 requires Node ≥ 22.12 for tooling).
- Push delivery looks recipients up in batches of 100. A school-wide broadcast previously
  put ~1,600 ids in one query string; the lookup would fail and nobody would be notified.
- `.env.example` is now tracked (the `.env*` ignore rule had been hiding it).

### Removed
- Unused client-side Firebase SDK (`firebase` dependency, `src/lib/firebase/storage.ts`) and
  the three `NEXT_PUBLIC_FIREBASE_*` variables only it used. Server-side `firebase-admin`
  is unchanged.
- Two orphaned components: `approval-checklist.tsx`, `class-teacher-assigner.tsx`.

### Fixed
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
