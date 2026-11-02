# Contributing

Read `AGENTS.md` first: this repo runs a Next.js version with breaking changes, so check
`node_modules/next/dist/docs/` before using a Next API.

## Run the checks

| Command | What it checks |
|---------|----------------|
| `npm run typecheck` | TypeScript, strict |
| `npx eslint src test e2e --max-warnings 0` | Lint, zero warnings allowed |
| `npm run test:unit` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run test:unit:coverage` | Same, with a coverage report in `coverage/` |
| `npm run build` | Production build (needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; dummy values are fine) |
| `npm test` | Playwright smoke tests (builds and starts the app itself) |
| `npm audit --omit=dev --audit-level=high` | Known-vulnerable production dependencies |

CI runs all of these on every pull request; a failing one blocks the merge. Node 22.12+ is
required for the test tooling (CI uses 24).

## Changes

- Branch from `master`, open a pull request, fill in the template.
- One logical change per commit. Subject line in the imperative, no trailing period, no
  prefix convention: `Fix notification toggle reverting on save`.
- Put pure logic in `src/lib/` and test it. Server actions and components stay thin.
- Database changes are new files in `supabase/migrations/` (next number). Never edit a
  migration that has been applied. The one exception: a guard that changes nothing on live
  but lets a fresh replay succeed (say why in the file). CI's "Migrations replay" job
  rebuilds the database from every file plus `seed.sql`; run the same locally with
  `npx supabase start` then `npx supabase db reset` (needs Docker). Every table needs RLS;
  see the PR template checklist.
- Keep `compliance/` and `FEATURES.md` in step with behaviour. Documentation that has
  drifted from the code is treated as a bug.
- Never commit secrets. Service-account and OAuth JSON files are gitignored; keep them
  outside the working tree where possible. CI runs a secret scan.

## Releases

Versions follow semver. Update `CHANGELOG.md`, bump `package.json`, tag `vX.Y.Z` on `master`
after CI is green.
