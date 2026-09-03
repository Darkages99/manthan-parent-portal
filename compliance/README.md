# Manthan Parent Portal — Compliance & Technical Documentation

> **Purpose of this folder.** This is the full, opened-up technical record of the
> Manthan Parent Portal: what it is, how it is built, every database table and
> relationship, how data moves from every point to every point, how access is
> controlled and secured, and how the whole thing is tested. It exists so the
> system is **not a black box** — any reviewer (a teacher, an auditor, a new
> engineer, a data-protection officer) can read these documents and understand
> the system end to end without reading the source code first.
>
> Every claim in these documents is traceable to a concrete artifact in the
> repository (a migration file, a source file, a config file). File references
> are written as `path:line` so they can be opened and verified.

---

## Document control

| Field | Value |
|-------|-------|
| System | Manthan Vidyashram Parent Portal |
| Document set version | 1.0 |
| Date issued | 2026-09-03 |
| Status | Baseline — reflects the codebase at commit `1d9f53a` (security hardening) |
| Database schema baseline | migrations `0001` … `0052` |
| Owner | Engineering |
| Audience | School leadership, teaching staff, auditors, data-protection reviewers, engineers |
| Classification | Internal — describes access-control and data-handling of minors' data |

**How to keep this current:** any change that adds/removes a table, an RLS
policy, a role, a server action, a route handler, or an external integration
**must** update the affected document below and, where relevant, the traceability
matrix (`11-traceability-matrix.md`). The security posture is separately tracked
in the repository-root `SECURITY_AUDIT.md`, which these documents reference
rather than duplicate.

---

## How to read this set

Read in order for a full induction, or jump to the document that answers your
question.

| # | Document | Answers the question… |
|---|----------|------------------------|
| 00 | [Glossary & conventions](./00-glossary-and-conventions.md) | "What does this term/role/word mean?" |
| 01 | [System overview & requirements](./01-system-overview-and-requirements.md) | "What is this system for, who uses it, and what must it do?" |
| 02 | [Architecture & trust boundaries](./02-architecture-and-trust-boundaries.md) | "What are the moving parts and where are the security boundaries?" |
| 03 | [Data dictionary](./03-data-dictionary.md) | "What data is stored — every table, column, type and relationship?" |
| 04 | [Data-flow specifications](./04-data-flow-specifications.md) | "How does data move from every point to every point?" |
| 05 | [Security & access control](./05-security-and-access-control.md) | "How is authentication, authorization and RLS enforced?" |
| 06 | [Functional modules & requirements](./06-functional-modules.md) | "What does each feature do, and what are its rules?" |
| 07 | [External integrations](./07-external-integrations.md) | "How does it talk to Google Sheets / Firebase / push / SMS / cron?" |
| 08 | [Testing & verification plan](./08-testing-and-verification-plan.md) | "How do we prove it works and stays secure?" |
| 09 | [Data governance & privacy](./09-data-governance-and-privacy.md) | "How is minors' PII handled, retained and protected?" |
| 10 | [Operations & runbook](./10-operations-and-runbook.md) | "How is it deployed, configured, backed up and recovered?" |
| 11 | [Requirements traceability matrix](./11-traceability-matrix.md) | "Where is requirement X implemented and tested?" |

---

## One-paragraph summary of the system

The Manthan Parent Portal is a web application (a progressive web app, installable
on phones) that connects a school's parents with its staff. Parents sign in to see
their own children's attendance, results, timetable, homework, fee status and
school messages, and to raise requests (leave, late-pickup/stay-back consent,
parent-teacher meetings, consultations, issue reports). Staff sign in to a console
to mark attendance, enter marks, author homework and timetables, approve requests,
and message parents. It is built on **Next.js 16 / React 19 / TypeScript**, with
**Supabase (PostgreSQL)** as the database and authentication provider, **Firebase
Cloud Storage** for files (report-card and receipt PDFs, message attachments), and
a set of low-cost notification channels (Web Push, an Android-phone SMS relay,
WhatsApp click-to-chat). The authoritative access-control mechanism is **PostgreSQL
Row-Level Security (RLS)**: every table has policies that restrict a parent to rows
connected to their own children and restrict staff to their role's scope. The
school's roster and academic configuration are managed from a **Google Sheet** that
syncs into the database on a daily schedule.

---

## Source-of-truth map (where the real artifacts live)

These documents describe the system; the following files **are** the system and
override any description here if they ever disagree:

| Concern | Authoritative artifact(s) |
|---------|---------------------------|
| Database schema, tables, RLS policies, functions | `supabase/migrations/0001_init.sql` … `supabase/migrations/0052_data_retention_and_erasure.sql` |
| Session / identity resolution | `src/lib/session.ts`, `src/lib/roles.ts` |
| Request-time session refresh | `src/proxy.ts`, `src/lib/supabase/middleware.ts` |
| Database clients (RLS vs. bypass) | `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts` |
| Server-side mutations (business logic) | `src/app/**/actions.ts` (31 files) |
| HTTP route handlers (uploads, exports, cron) | `src/app/api/**/route.ts` (10 files) |
| External integrations | `src/lib/google-sheets.ts`, `src/lib/firebase/*.ts`, `src/lib/notifications/*.ts` |
| Security posture & audit findings | `SECURITY_AUDIT.md` (repo root) |
| Feature test tracker | `FEATURES.md` (repo root) |
| Deployment / cron / headers config | `next.config.ts`, `vercel.json`, `Dockerfile`, `storage.rules` |
