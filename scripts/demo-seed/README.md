# Demo seed — massive-scale isolated test data

Generates a full simulated school on top of the live Supabase project: ~30
classes (Grades 1–10 × Sections A/B/C), ~800 students, ~1,400 guardians, ~49
staff, and realistic data across every module (attendance, results,
timetable, PTM, messages, leave, stay-back, defaulters, DTR, groups, QR
codes, invoices) — including deliberately-planted edge cases (low
attendance, failing grades, a timetable teacher collision, open/unbooked
PTM slots, unread urgent messages, etc).

## Isolation

Every row this script inserts gets a primary-key uuid starting with the
literal `5eed0000-` ("seed", valid hex). Nothing else in the database ever
has that prefix — the pre-existing hand-written placeholder seed
(`supabase/seed.sql`, ids `a0/b0/c0/d0000000-...`) is untouched. Demo classes
also use `academic_year = 'DEMO 2026-27'`, distinct from real class years.

A curated subset of staff/guardians get real `auth.users` logins so you can
actually click through the app as different personas — email pattern
`demo.<slug>@manthan-demo.test`, all sharing one password. The full list
(with what scenario each account demonstrates) is written to
`CREDENTIALS.md` after seeding (git-ignored — regenerated each run).

## Usage

```bash
npm run demo:seed      # generate + insert everything (aborts if already seeded)
npm run demo:teardown  # delete everything this script created, incl. the auth accounts
```

Both scripts read `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
from `.env.local` (via `node --env-file`), and use the service role key to
bypass RLS — the same way any admin/seeding tool would.

To regenerate with different random data, edit the seed in `seed.mjs` (it's
deterministic — same seed in `lib/rng.mjs` always produces the same dataset)
or bump the RNG seed, then `npm run demo:teardown && npm run demo:seed`.
