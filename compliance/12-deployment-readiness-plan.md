# 12 — Deployment-Readiness Plan

**Purpose.** Define exactly what must be done, and what evidence must exist, for a
senior software engineer to accept this system as *deployment-ready for a
single-school production pilot* — and for it to survive the move from
Supabase + Vercel to the school's own servers.

**Status of this document:** plan. Written 2026-11-01 against `HEAD` `030b5a7`.
Every "current state" claim below was measured on that date; the command that
reproduces it is given so a reviewer can re-check it.

---

## 1. What "deployment-ready" means here

The objection "it was vibe-coded, so it can't be deployed" is not really about how
the code was written. A reviewer cannot tell from a file who typed it. What they
can ask is:

1. **Does it do what it claims?** → automated tests, not assertions.
2. **Can it be changed safely?** → CI gate, typed contracts, reviewed changes.
3. **Can it be rebuilt and run by someone else?** → reproducible build, migrations
   replay from zero, documented configuration.
4. **Is it safe with children's data?** → provable access control, patched
   dependencies, audit trail, tested backups.
5. **Can it be operated?** → health checks, logs, alerts, runbook that was rehearsed.
6. **Is it trapped on a vendor?** → portability to the school's servers.

Code produced with AI assistance is acceptable to a conventional engineering review
**if and only if** it clears the same bar as any other code. This plan builds that
evidence. The documentation set (docs 00–11) answers "what is it"; this plan builds
the proof for "does it work, is it safe, can it be run".

**Scope of "ready".** One school, one deployment, a pilot with real parents and
staff. Not multi-tenant SaaS, not high-scale. The bar is *engineering discipline*,
not scale.

---

## 2. Honest current state (measured 2026-11-01)

| Area | Today | Evidence / reproduce with |
|------|-------|---------------------------|
| Codebase | ~29.5k lines TS/TSX, 42 commits, 1 author, no tags/releases (`0.1.0`) | `git log`, `package.json` |
| Types | ✅ clean | `npx tsc --noEmit` → exit 0 |
| Lint | 🟡 1 error, 1 warning | `npx eslint src` |
| Unit tests | ❌ 0 | no `*.test.*` files |
| RLS tests | 🟡 manual SQL only; not repeatable | `SECURITY_AUDIT.md` §5 |
| E2E | 🟡 5 smoke tests, all unauthenticated | `e2e/smoke.spec.ts` |
| UAT | ❌ every `FEATURES.md` row untested | `FEATURES.md` |
| CI/CD | ❌ none | no `.github/` |
| Dependency security | 🔴 37 advisories: **1 critical (`next@16.2.12`, fix `16.4.3`)**, 10 high (`firebase`, `postcss`, `sharp`, `zod`, …) | `npm audit` |
| Secrets in git | ✅ none tracked, none in history | `git log --all --diff-filter=A --name-only` |
| Secret files on disk | 🟡 service-account / OAuth JSONs sit in the repo working directory (gitignored) | repo root listing |
| Reproducible DB | 🟡 `supabase/migrations/0001…0052` exist; **never proven to rebuild an identical schema from zero**; no `supabase/config.toml`; live migration history uses different names/versions than the files | `list_migrations` vs `ls supabase/migrations` |
| Offline / self-host build | ❌ `next build` needs Google Fonts at build time | `src/app/layout.tsx` (`next/font/google`) |
| Observability | ❌ no health endpoint, no error tracking, `console.*` + Vercel logs only | grep |
| Rate limiting | ❌ none on app endpoints (listed as a check in `SECURITY_AUDIT.md` §4.10, never closed) | |
| Environments | ❌ one Supabase project, no staging | |
| Backup/restore | 🟡 provider-managed; **no restore drill ever performed** | doc 10 §7 |
| Documentation | ✅ 13-file set, re-verified against the live DB 2026-11-01; **no mechanism stopping it drifting again** | this folder |
| Security review | 🟡 self-audit only (`SECURITY_AUDIT.md`); no independent review | |
| Dead / legacy code | 🟡 `reminders` table, `ptm_slot_request` enum value, `admin` role value, `ptm_meeting_teachers` history | doc 03 |

**Strengths to lead with** (real, and verifiable): RLS on all 49 tables with
guardian-scoped policies; security hardening of 13 findings already done and
re-verified (0050); versioned audit trail (0051); retention + erasure (0052);
deferred integrity triggers (0040); typed DB contract; PII-scrubbed logging;
fail-closed cron; non-destructive roster sync with super-admin confirmation.

---

## 3. Workstreams

Each workstream lists **tasks**, the **artifact** a reviewer can open, and an
**exit criterion** that is binary. Effort is rough working days for one engineer.

### WS-1 — Quality gate in CI (≈2 d) — *do first; everything else plugs into it*
| # | Task | Artifact |
|---|------|----------|
| 1.1 | Fix the lint error (`theme-toggle.tsx`) and warning (`results-view.tsx`) | `eslint` exit 0 |
| 1.2 | GitHub Actions workflow on every PR/push: `tsc --noEmit`, `eslint`, unit tests, `next build`, `npm audit --omit=dev --audit-level=high`, secret scan (gitleaks) | `.github/workflows/ci.yml`, green badge |
| 1.3 | Branch protection on `master`: PRs required, CI must pass; PR template with a checklist (tests, docs, migration, RLS) | repo settings screenshot, `.github/pull_request_template.md` |
| 1.4 | Dependabot/Renovate for npm + GitHub Actions | `.github/dependabot.yml` |
| 1.5 | `CODEOWNERS`, `CONTRIBUTING.md` (commit style, how to run checks), `CHANGELOG.md`, git tags from `v0.2.0` | files + tags |

**Exit:** a PR with a type error, a lint error, a failing test or a leaked secret
cannot merge.

### WS-2 — Automated tests (≈10–12 d) — *the core of the credibility answer*
**2A. Unit tests (Vitest), ≈3 d.** Pure logic first — cheap, high value:
`approvals.ts` (`computeSubjectStatus`), `approval-match.ts`, `stay-back-chain.ts`
(grade 7 vs 8 chain), `leave-status.ts` (expired), the 3-day leave rule,
`grade-boundaries.ts`, `results-analytics`, `results-scope.ts`, `teacher-scope.ts`,
`csv.ts` (formula-injection prefixes), `date-range.ts`, `attendance*.ts`,
`roles.ts`, `format.ts`, `timetable.ts`, PTM slot generation, default slot length by
grade. *Target:* ≥80% line coverage on `src/lib/**`; coverage published by CI.

**2B. RLS as code, ≈4 d.** Convert `SECURITY_AUDIT.md` §5 and doc 08 §4 prose into an
executable suite (pgTAP, or a Node runner that opens a transaction, does
`set local role authenticated`, sets JWT claims, asserts, and rolls back). One
file per table; for every table: guardian-own ✅, guardian-other ❌, each staff role
✅/❌, anon ❌. Include the red-flag list in doc 08 §4 and every `WITH CHECK`
binding. Runs against a throw-away local Supabase in CI. *This is the strongest
single piece of evidence for a children's-data system.*

**2C. Integration tests of server actions, ≈2 d.** Against the same local database:
`bookSlot` race (two parallel claims → exactly one wins), `deleteMeeting` cascade +
notification, `decideLeave` 3-day rule, stay-back chain build + decide order,
`saveMarks` scope, attachment upload ownership, cron auth (missing/empty/wrong
secret → 401), `erase_student` completeness, `prune_old_records` windows.

**2D. E2E with authenticated roles (Playwright), ≈3 d.** Seed fixed users
(`scripts/demo-seed` already exists) and cover: parent happy paths (view
attendance/results/homework, raise leave, book PTM, request consultation); staff
happy paths per role; **cross-family isolation through the UI** (guardian A cannot
reach guardian B's child); role gating of console pages. Run on every PR; keep
traces/videos as artifacts.

**Exit:** `npm test` runs all four layers locally and in CI; CI publishes a
coverage report and a test report; every `FR-*` in doc 11 cites at least one
test **file** (not a level code) — doc 11 is regenerated to show that.

### WS-3 — Reproducible environments (≈3 d)
| # | Task | Artifact |
|---|------|----------|
| 3.1 | `supabase init` → commit `config.toml`; `supabase start` + `supabase db reset` replays `0001…0052` + `seed.sql` on an empty database with no errors | CI job "migrations replay" |
| 3.2 | Schema-drift check: `supabase db diff` between a fresh replay and the live project must be empty (resolves the file-name vs live-history mismatch) | drift report; fix migration files or record a baseline migration |
| 3.3 | One-command local setup: `docker compose up` (app + local Supabase) and a README "first 15 minutes" | `docker-compose.yml`, README |
| 3.4 | `.env.example` is exhaustive and validated at boot (fail fast with a clear message listing missing vars) | `src/lib/env.ts` |
| 3.5 | Create a **staging** Supabase + Firebase + hosting target; promotion path staging → production; production secrets never used in staging | doc 10 §3 updated |
| 3.6 | Move secret JSON files out of the repo directory into a secrets store; rotate the Google OAuth client secret and service-account keys if those files were ever shared | rotation log |

**Exit:** a new engineer, with only the repo and the README, gets a working local
instance in under 30 minutes, and CI proves migrations rebuild the schema.

### WS-4 — Code health (≈3 d)
- Remove dead/legacy schema and code via migrations: `reminders` table,
  `ptm_slot_request` enum value, `admin` role value, orphaned components. (Each is
  documented in doc 03 as legacy today.)
- Enable `"strict": true` verification and forbid `any`/`@ts-ignore` via lint rules;
  report count of suppressions (target 0).
- Architecture Decision Records (`docs/adr/`): RLS-first authorization; Sheet as
  roster source of truth; the 15 service-role sites; Firebase bearer-token URLs;
  first-come-first-served PTM (0041); leave approve-only; opt-out notifications.
  Short (1 page each) — they record *why*, which review code alone cannot.
- Run a dependency/size review (`knip` or `ts-prune`) and delete unused exports.

**Exit:** `eslint` zero warnings; ADRs exist for each decision a reviewer will
question; no unused tables/enum values.

### WS-5 — Security closure (≈5 d, + external review)
| # | Task | Notes |
|---|------|-------|
| 5.1 | **Upgrade `next` 16.2.12 → ≥16.4.3** (critical advisory) and clear the high advisories (`firebase`, `postcss`, `sharp`, `zod`) | Next here has breaking changes — read `node_modules/next/dist/docs/` first (see `AGENTS.md`); full test run before/after |
| 5.2 | Reach `npm audit --omit=dev --audit-level=high` = clean in CI; document any accepted advisory with justification and expiry | WS-1 gate |
| 5.3 | Rate limiting on activation, OTP, login-adjacent endpoints, export and upload routes (closes `SECURITY_AUDIT.md` §4.10) | reverse-proxy or in-app limiter |
| 5.4 | Add a real CSP (nonce-based `script-src`) beyond `frame-ancestors` | `next.config.ts` |
| 5.5 | Enable Supabase Leaked-Password Protection (F11); decide on magic-link activation (F5) | dashboard setting + decision |
| 5.6 | Clear Supabase security + performance advisors (`get_advisors`), commit the report | advisor report |
| 5.7 | Static analysis in CI: CodeQL or Semgrep | CI job |
| 5.8 | Re-run the full `SECURITY_AUDIT.md` checklist after WS-2 exists, so each finding has a regression test | updated audit |
| 5.9 | **Independent review**: commission a third party (or a security-minded engineer who did not write the code) to review RLS + the 15 service-role sites + upload/export routes; publish scope and findings | signed report |
| 5.10 | Decide the file-access model: Firebase token URLs are bearer credentials (knowledge of URL = access). Either accept with written justification or move to short-lived signed URLs behind an authenticated route | ADR |

**Exit:** zero critical/high production advisories; every audit finding has a test;
an outside reader has reviewed and signed off.

### WS-6 — Operability (≈4 d)
| # | Task | Artifact |
|---|------|----------|
| 6.1 | `GET /api/health` (app + DB reachability, no secrets) and a readiness check | route + monitor |
| 6.2 | Error tracking (Sentry, or self-hostable GlitchTip) with PII scrubbing consistent with `logError` | integration + redaction test |
| 6.3 | Structured JSON logs with request ids; log level by env | `src/lib/log.ts` |
| 6.4 | Uptime monitoring + alert route (email/WhatsApp to a named on-call person) | monitor config |
| 6.5 | **Backup/restore drill**: restore the latest backup into staging, run the RLS suite, record elapsed time and result. Set and document RPO/RTO | dated drill record in doc 10 |
| 6.6 | Rollback plan per release (app image tag; forward-only migration policy with a documented "undo" for each risky migration) | doc 10 §3–4 |
| 6.7 | Incident runbook rehearsed once (tabletop: leaked key; bad deploy; DB restore) | exercise notes |

**Exit:** a failure produces an alert; a restore has been performed and timed; a
release can be rolled back by following a document.

### WS-7 — Portability to the school's servers (≈8–10 d) — *the stated next phase*
**Target (decided 2026-11-01):** self-hosted Supabase stack on the school's own
servers, **no third-party service trusted**. The design goal is to make the move a
**configuration change, not a rewrite**.

**"Airgapped" interpretation (to confirm with the school).** A parent portal must be
reachable by parents' phones, so a literally disconnected network is impossible.
The working definition used in this plan is: *all data, authentication, storage and
processing live on school hardware; no student/guardian/staff data is sent to, or
stored by, any third-party SaaS; the server makes no outbound calls except those
explicitly allow-listed.* The one structural exception is browser push (below).
If the school means something stricter, WS-7.9 must be re-planned.

Current coupling and recommended path:

| Dependency today | Coupling | Recommended path off-vendor |
|------------------|----------|------------------------------|
| Vercel hosting | low — `output: "standalone"` + `Dockerfile` exist | Run the container behind the school's reverse proxy (Caddy/Nginx) with TLS; **prove it** with `docker compose` in CI |
| Vercel Cron | low — it is just `GET /api/cron/tick` with a bearer token | OS `cron`/systemd timer or a sidecar calling the same endpoint |
| `next/font/google` | **blocks offline/self-host builds** | switch to `next/font/local` (self-hosted font files) |
| Supabase (Postgres + Auth + PostgREST) | **high** — RLS depends on `auth.uid()` and Supabase JWTs; `@supabase/ssr` throughout | Lowest-risk path: **self-host the Supabase stack** (official docker compose) so RLS, Auth and the client code are unchanged. Record the decision in an ADR; do not attempt "plain Postgres" without a rewrite estimate |
| Firebase Cloud Storage | medium — isolated in `src/lib/firebase/*` | Put an interface in front of storage (`put/get/delete/list`, signed-URL issue) with a Firebase adapter and an S3-compatible adapter (MinIO or the school's object store); migrate objects with a script |
| Google Sheets roster sync | medium — external SaaS holding the whole roster (minors' PII) (DG-2) | **Incompatible with the no-third-party rule.** Decision 2026-11-01: keep for the cloud pilot only; for the self-hosted deployment replace with an in-app CSV/XLSX import (same tab contract, same pending-deletion safety) behind a feature flag; Sheets sync is disabled by config when self-hosted |
| Google OAuth sign-in | medium — `signInWithOAuth` on the landing page | Disabled when self-hosted (needs Google); email/password remains |
| Phone OTP login | medium — `signInWithOtp` needs an SMS provider configured in Supabase Auth | Route through the school's own SMS relay/gateway or disable; verify what actually works with no external provider |
| Email (password reset, invites) | medium — Supabase Auth needs SMTP | Use the school's own SMTP server |
| Web Push / VAPID | **structural exception** — the server must reach each browser vendor's push service (FCM/Mozilla/Apple) to deliver; payloads are encrypted end-to-end but metadata leaves the network | Accept as a documented, allow-listed outbound exception (payload text should stay minimal), or drop push for in-app inbox + SMS relay. Owner decision |
| SMS relay, WhatsApp link | none | unchanged |

Also produce: sizing guide (CPU/RAM/disk for the expected user count), network
diagram, TLS/firewall requirements, backup targets on school hardware, and a
data-migration runbook (export from Supabase cloud → import to self-hosted;
Firebase objects → object store; DNS cut-over; rollback).

**Airgap-specific tasks (WS-7.9):** build the image in a connected CI, then transfer
image + SBOM by signed offline bundle (the server never runs `npm install`); mirror
or vendor every base image; internal CA + TLS; NTP from an internal source;
self-hosted monitoring/error tracking (Uptime Kuma + Prometheus/Grafana, GlitchTip)
instead of SaaS; an offline update procedure with version pinning and rollback;
network allow-list documented (inbound 443 from the internet; outbound only SMTP,
SMS relay, and optionally push services); verify with the server's outbound
firewall set to *deny all* that every core flow still works.

**Exit:** the full stack comes up from `docker compose` with **no** Vercel, Google
Fonts, Firebase, Google OAuth or Google Sheets dependency for the core flows, and
the E2E suite passes against it with outbound traffic blocked.

### WS-8 — Non-functional evidence (≈3 d)
- Load test (k6). **Sizing basis (school, 2026-11-01):** 800 students, ~2 guardians
  each = ~1,600 parent accounts, 100+ teachers/staff (~1,700 users). At ~2 visits per
  parent per day plus heavier staff use that is roughly 3,500–5,000 sessions/day.
  Assume a morning/evening peak where ~15% of parents hit within 30 minutes
  (~250 users) plus all staff, and a results-release spike. **Test at 500 concurrent
  virtual users** (≈2× peak), mixed read-heavy parent traffic + attendance/marks
  writes + a push fan-out to ~1,600 guardians; record p95 latency, error rate and DB
  CPU. Acceptance targets: p95 < 800 ms on reads, < 0.1% errors, a 1,600-recipient
  broadcast fully queued within 60 s. Expected hardware: one 4 vCPU / 16 GB / SSD
  host runs app + self-hosted Supabase comfortably; recommend a second host for
  backups.
- Review slow queries / missing indexes using the Supabase performance advisor;
  fix N+1 patterns.
- Accessibility (axe/Lighthouse) on the main parent screens; PWA install check on
  low-end Android and iOS 16.4+.
- Browser/device matrix actually tested, listed.

**Exit:** published numbers, not adjectives.

### WS-9 — Documentation that cannot silently rot (≈2 d)
Docs 00–11 were found out of date on 2026-11-01 (PTM approval chain and delete
guard, leave decline, cron jobs, enum values, service-role site list). To stop
recurrence:
- A script `scripts/docs-check.mjs`, run in CI, that fails if: a `path` referenced
  in `compliance/**` does not exist; the migration range in the README ≠ `ls
  supabase/migrations`; the table count ≠ the migrations' `create table` count; a
  `FR-*` in doc 01 has no row in doc 11; a doc 11 row has no test file.
- PR template item: "Does this change a table, policy, role, action, route or
  integration? Update `compliance/` and `FEATURES.md`."
- Add: privacy notice + DPIA (data-protection impact assessment) draft, records of
  processing, and a subject-request procedure (access / correction / erasure) using
  the existing `erase_student`.
- Known-limitations register (what the system deliberately does not do: online
  payments, automated WhatsApp, etc.) so reviewers see them as decisions.

**Exit:** a drifting doc fails CI.

### WS-10 — Acceptance by the school (≈3 d + school time)
- Execute `FEATURES.md` top to bottom, converting `[ ]` to `[x]`/`[!]` with date and
  tester; fix every `[!]`. Rewrite the file so each row names its automated test.
- Pilot with one class/grade before whole-school; collect and triage feedback
  (`User Reviews.md` is the seed).
- Written sign-off by the principal for the pilot scope.

**Exit:** `FEATURES.md` has zero `[ ]` rows in pilot scope and a signed acceptance.

---

## 4. Sequencing

| Phase | Weeks | Workstreams | Gate to leave the phase |
|-------|-------|-------------|-------------------------|
| 0 — Truth | done 2026-11-01 | docs re-verified; this plan | docs match the live DB |
| 1 — Safety net | 1–2 | WS-1, WS-2A, 5.1–5.2, 4 (lint/dead code) | CI green; critical/high advisories gone; unit tests live |
| 2 — Proof | 3–5 | WS-2B/C/D, WS-3, WS-9 | RLS + action + E2E suites green in CI; clean-room rebuild works |
| 3 — Operate | 6–7 | WS-6, 5.3–5.8, WS-8 | health/alerts live; restore drill done; load numbers recorded |
| 4 — Portable | 8–10 | WS-7 | compose stack passes E2E with no Vercel/Google-Fonts/Firebase |
| 5 — Accept | 9–11 (overlaps) | WS-10, 5.9 | signed UAT + external review |

Roughly **6–8 engineer-weeks**. Phases 1–2 are what changes the conversation with a
senior reviewer; phase 4 is what the school's server migration needs.

---

## 5. The evidence pack to hand over

When the workstreams are done, the "prove it" folder is these artifacts, each
regenerable by a command or a CI run:

1. This compliance set (docs 00–12) — what it is, how it is secured, how data flows.
2. CI run history + required-check branch protection — changes are gated.
3. Test report + coverage + the RLS matrix report — behaviour and access control
   are proven by execution.
4. `npm audit` / CodeQL / secret-scan results — supply-chain and code-level security.
5. Migration replay + schema-drift report — the database is reproducible.
6. Backup-restore drill record with timings — recovery is real.
7. Load-test and accessibility reports — non-functional claims have numbers.
8. ADRs — the reasoning behind each non-obvious decision.
9. Independent security review report.
10. Signed UAT / pilot acceptance.
11. Self-hosting guide + the compose stack that passes the same tests.

---

## 6. Decisions and inputs

**Decided 2026-11-01**
1. **Scale:** 800 students, ~1,600 guardians, 100+ staff; ~2 sessions/day per parent,
   staff more. (Drives WS-8 and sizing.)
2. **Hosting:** self-hosted Supabase stack on school servers; no third-party service
   trusted ("airgapped" as defined in WS-7).
3. **Roster source:** keep Google Sheets **for the cloud pilot only**. It sends the
   entire roster of minors to Google and is incompatible with the self-hosted,
   no-third-party target, so the self-hosted build gets an in-app CSV/XLSX import
   instead.

**Still open**
4. **Retention windows** in `prune_old_records()` (currently 24/24/12/12 months) —
   the school's decision.
5. **Who is the independent reviewer** (WS-5.9) and the budget.
6. **Pilot scope** (which grades) and who signs acceptance.
7. **RPO/RTO the school can accept** (e.g. lose ≤ 24 h of data; restore within 4 h).
8. **Airgap definition** - confirm the interpretation in WS-7 (data and processing on school hardware, allow-listed outbound only).
9. **Browser push** - accept the allow-listed outbound exception to FCM/Mozilla/Apple, or drop push in favour of in-app inbox + SMS relay.

---

## 7. What not to claim

- Do not call it "tested" until WS-2 exists; today `tsc` passes and five smoke tests
  pass — that is all.
- Do not call it "secure" without qualification while `npm audit` shows a critical
  advisory in `next`.
- Do not claim the schema is reproducible until WS-3.2 shows an empty drift diff.
- Do not claim a backup works until WS-6.5 has been performed.
- "Reviewed by a security engineer" only after 5.9.

Honest framing for the reviewer: *"The architecture and access-control design are
sound and documented; the verification and operations layers are what we are
building now, and here is the dated plan and the evidence trail."* That is a
stronger position than an unverifiable assurance.
