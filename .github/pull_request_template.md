## What and why

<!-- One or two sentences. Link the TODO.md item or issue. -->

## Checks (CI enforces the first four)

- [ ] `npm run typecheck`, `npx eslint src test e2e --max-warnings 0`, `npm run test:unit` pass
- [ ] `npm run build` passes
- [ ] No new production advisories (`npm audit --omit=dev --audit-level=high`)
- [ ] No secrets, keys, tokens or personal data in the diff

## Tests

- [ ] New or changed logic has a unit test (pure logic goes in `src/lib/**` with a `*.test.ts` beside it)
- [ ] A bug fix includes a test that fails without the fix
- [ ] User-visible flow changed: `FEATURES.md` row updated

## Documentation

- [ ] Changes a table, policy, role, server action, route or integration? Updated the matching file in `compliance/`
- [ ] User-visible change noted in `CHANGELOG.md` under *Unreleased*
- [ ] Ticked the item in `TODO.md` with date and evidence (if it closes one)

## Database changes (delete this section if none)

- [ ] New migration file in `supabase/migrations/` (next number, never edit an applied one; "Migrations replay" CI job passes)
- [ ] Every new table has RLS enabled and policies for each role that needs access
- [ ] Guardian access is scoped through `guardian_student`; no `using (true)` for authenticated users
- [ ] `src/lib/supabase/database.types.ts` regenerated
- [ ] Rollback / forward-fix noted below

## Security-sensitive changes (delete if none)

- [ ] Touches a service-role (`createAdminClient`) call site, upload/export route, or auth flow: described below and listed in `compliance/05-security-and-access-control.md`
- [ ] User input validated server-side; file names/paths sanitised
