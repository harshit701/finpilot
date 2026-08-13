# FinPilot — Project Context for Claude Code

## Before anything else: this is not a greenfield project

**Work has already started in this folder.** This file describes the plan
and the decisions made so far — it does NOT describe an empty repo waiting
to be scaffolded. Do not run a fresh NestJS/React scaffold, do not
overwrite existing files, and do not assume Sprint 0 hasn't happened.

Your first action in any new session on this project, before writing or
suggesting any code:

1. **Look at what's actually here.** Run something equivalent to
   `git log --oneline -20`, `git status`, and a directory listing
   (`find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*'`).
   Read the `package.json` files if present to see what's actually
   installed, not just what's planned below.
2. **Compare that against the sprint plan below** and work out, honestly,
   which sprint/stories are actually done, which are partially done, and
   which haven't been started. Don't take a sprint number on trust from
   the person without checking — and don't take it on trust from this
   file either, since this file may be stale relative to the actual repo.
3. **State what you found** back to the person in a short summary before
   proceeding — "here's what exists, here's what I think is done, here's
   where I'd pick up" — so any mismatch between their memory and the repo
   surfaces immediately rather than causing rework later.
4. Only then take the person's actual instruction for the session.

If the repo structure, table names, library choices, or anything else
below turns out to not match what's actually in the folder, **trust the
repo, not this file** — and flag the mismatch to the person, since it
likely means this file needs updating.

---

Read the rest of this file for the shape of the project before writing any
code. Full detail lives in Notion — this file is the compressed version so
you have context before the person gives you a single instruction. If
something here conflicts with Notion, Notion wins; if something here
conflicts with the actual repo, the repo wins — either way, tell the
person, don't silently resolve it.

**Notion hub:** ask the person for the FinPilot hub page link if you have
Notion MCP access, and read: `02 v1 Scope`, `03 Decision Log`,
`05 Requirements Breakdown` (all 9 epics), `06 Sprint Plan`,
`07 System Design` (Data Model, API Contracts, Auth Architecture, Import
Pipeline Architecture, Content and Observation Architecture).

---

## What FinPilot is

A personal finance web app that **educates, never directs**. It shows a
person where they stand financially and explains what that means — it never
tells them what to do with their money, never assigns a stage or score, and
never names a specific financial product. Single user per account, single
currency (INR), web only, for v1.

The governing tone principle: **every number and message should leave the
person clearer and calmer, not judged.** If a piece of copy could read as
shame or a verdict, it's wrong regardless of accuracy.

Six design principles (full text in `02 v1 Scope`):
1. Educate, never direct
2. Clarity over judgement
3. No verdicts, no rankings, no stages
4. Honest about incomplete data — say so rather than guess
5. Behaviours and concepts, never products
6. No number without meaning available on demand

## Who's building this

One person, solo, 30–40 hours/week, treating it as a real product to put in
front of real users eventually — not a portfolio project. Twice-weekly
retros, monthly demo. Thin vertical slices: every story ships something
usable in a browser, frontend included, never backend-only.

---

## Tech stack

- **Backend:** NestJS, Prisma, PostgreSQL, REST (GraphQL later if a real
  need appears, not speculatively)
- **Frontend:** React
- **Auth:** JWT access token (short-lived, stateless) + refresh token
  (server-side, hashed, revocable — see Decision Log)
- **Email:** Nodemailer + Gmail SMTP for v1 (free, no third-party signup)
- **Docs:** Swagger, generated from code
- **Infra:** Docker for local Postgres. AWS, queues, async workers — later,
  not now.

---

## Non-negotiable technical rules

These come from the Decision Log. Do not deviate without asking.

- **Money is always an integer in minor units (paise).** Never a float or
  decimal, at any layer — database, API, application code, client state.
  This is the single most important rule in the codebase.
- **Dates are calendar dates (`YYYY-MM-DD`), never timestamps**, for
  anything representing when a transaction happened. Reference timezone is
  fixed IST. Week starts Monday. Both fixed for all users in v1, not a
  preference.
- **Refresh tokens are stored server-side, hashed, one row per session**
  (a `sessions` table), not pure stateless JWT — this is what makes
  logout, password-reset session invalidation, and stolen-token detection
  via reuse actually work. Access token stays a short-lived stateless JWT.
- **Categories are per-user rows**, not a shared table — deliberately, for
  simplicity, even though it duplicates ~15–19 rows per user. Don't
  "optimize" this into copy-on-write without discussing it first.
- **Transactions use soft delete** (`deleted_at`), not hard delete — this
  is what makes the undo-after-delete window (Story 3.4) simple. Every
  query against `transactions` must filter `deleted_at is null`; this
  should be enforced at the data-access layer, not left to each call site.
- **Category type (expense/income) is immutable after creation.**
  Transaction direction is immutable after creation. Both would silently
  invert historical data if editable.
- **Every data-fetching query filters by the authenticated user's identity
  at the query level**, never by post-fetch filtering. Requesting another
  user's record by ID returns 404, never 403 — a distinguishable forbidden
  response confirms the record exists, which is itself a leak.
- **One error envelope shape for every endpoint** — see API Contracts in
  Notion for the exact JSON shape (`error.code`, `error.message`,
  `error.fields`). Internal errors never leak a stack trace or DB message.
- **Email verification enforcement is a config flag, default off** — not
  something toggled by hand-editing a database row. Build the full flow;
  gate it in config.

---

## The nine epics (55 stories total)

1. **Access & Identity** — register, login, logout, sessions, reset
   password, email verification, profile, data isolation (cross-cutting)
2. **Categories** — system defaults, create, edit, delete with reassignment
3. **Money Movement** — transaction CRUD, fast entry (under 10s target),
   search/filter, amount & date integrity (cross-cutting)
4. **Declaration** — skippable onboarding for facts transactions can't
   reveal (insurance, savings, obligations), with staleness tracking
5. **Import** — CSV/XLSX upload, column mapping, duplicate detection, bulk
   categorisation, preview-before-commit, reversal. Largest epic.
6. **Dashboard** — week/month/year lenses, in/out/surplus, category
   breakdown, period comparison, data-completeness signal
7. **Understanding** — the differentiating layer: content store, concept
   education, situational observations, pre-investing essentials
   (protect/buffer knowledge, explicitly NOT a stage ladder), education
   decay, tone review as a shipping gate (cross-cutting)
8. **Goals** — user-defined, progress from *observed* surplus not asserted
   income, connection to spending shown as arithmetic, never as advice
9. **Engineering Foundations** — not a feature, never finishes. Config,
   error envelope, migrations, local dev, testing, docs, CI, frontend
   shared machinery.

Three cross-cutting stories apply to every epic, not once: **1.7 Data
isolation**, **3.6 Amount & date integrity**, **7.6 Tone review**. Every
new resource needs isolation tests; every money/date computation needs
integrity tests; every piece of user-facing copy needs a tone-review pass
before it ships.

---

## Sprint plan (13 sprints, ~60hrs each)

**Resequenced from the original plan** — import moved from mid-plan to
last (sprints 11–13), because the person building this is currently the
only user, so import's cold-start justification isn't live yet. The full
app is usable end to end on manual entry alone by **sprint 10**.

**Actual progress as of the last session should be tracked here.** After
your first-session inspection (see top of this file), update the table
below with a real status column, and keep it updated as sprints complete —
this is what lets the next session pick up accurately without re-deriving
it from git history every time.

**Last verified against the repo: 2026-08-13.** Cross-checked against
Notion (`06 Sprint Plan`, Epic 1 requirements) and against the actual code
in `apps/backend` — see file-level status below the table before trusting
any row as fully done.

| Sprint | Content | Status |
|---|---|---|
| 0 | Foundations: config, error envelope, migrations, Docker, frontend skeleton | 🟡 Partial — backend config/Prisma/Docker/Swagger done; **no frontend skeleton exists anywhere in the repo** |
| 1 | 1.1 Register, 1.2 Login | ✅ Done — anti-enumeration + timing-equalized on both, login rate-limited, tests passing. No frontend, so not "demonstrable in a browser" per the DoD |
| 2 | 1.3–1.6, 1.8: logout, sessions, reset, verification, profile | 🟡 Partial. Done: 1.3 logout (revokes by `sid`), 1.4 refresh rotation + reuse-family-revoke (backend only — no frontend to hold the single-flight refresh queue). Not started: 1.5 reset password (no endpoint, no token model, no email sending), 1.6 profile (no `GET/PATCH /users/me`, no income/dependants fields). Scaffolded only: 1.8 email verification — `isEmailVerified` field, `EmailVerifiedGuard`, config flag all exist and are tested, but there is no verification token model, no send-on-register, no `/auth/verify` or `/auth/verify/resend` endpoint, and `nodemailer` isn't in `package.json` yet |
| 3 | Epic 2 entire: categories | ❌ Not started |
| 4 | 3.1, 3.2, 3.6: record transaction, fast entry, integrity | ❌ Not started |
| 5 | 3.3–3.5: edit, delete, search/filter | ❌ Not started |
| 6 | 6.1–6.3: dashboard, period lenses, breakdown | ❌ Not started |
| 7 | 7.1, 7.6, one observation rule, 6.4: **the first situational observation, end to end — do not skip this** | ❌ Not started |
| 8 | Epic 4: declaration | ❌ Not started |
| 9 | 7.2, 7.4, 7.5, 6.6: rest of understanding layer | ❌ Not started |
| 10 | Epic 8: goals. **App is complete on manual entry here.** | ❌ Not started |
| 11–13 | Epic 5 entire: import | ❌ Not started |

**1.7 Data isolation** (cross-cutting): structurally satisfied so far —
every query is scoped by the authenticated session's `sub` — but there's
no epic past Access yet to exercise the cross-user test matrix against,
so treat it as unverified rather than done.

**Sprint 7 is the highest-priority sprint in the whole plan.** The scope
doc's core risk is building the dashboard and skipping situational
observations because they're the hardest part, shipping a tracker with a
glossary attached. Building one observation rule early and end-to-end,
before the rest of the epic, is the deliberate mitigation. Do not let this
slip to "later in Epic 7."

**When a sprint overruns:** never cut acceptance criteria to fit — move
the whole story. Never cut the three cross-cutting stories. Cut
Could/Should before Must. A story that slips twice needs splitting, not
another sprint.

---

## Data model summary

Full schema with reasoning is in Notion → System Design → Data Model.
Core tables: `users`, `sessions` (refresh tokens), `categories`,
`transactions`, `declarations` (one wide row per user, per-fact
timestamps), `goals`, `imports` + `import_rows` (staging, nothing hits
`transactions` before commit), `saved_mappings` (column-mapping memory,
keyed by a hash of the header row shape), `education_content` +
`education_deliveries` (decay tracking), `observation_dismissals`.

Situational observations are **computed at request time** for v1, not
precomputed — deliberately simple, revisit only when email nudges (still
deferred) require a scheduled job instead.

---

## Explicitly deferred, don't build unless asked

Bank/UPI/wallet integration, SMS parsing, investment tracking, net worth
tracking, specific product recommendations, multi-currency, shared/family
accounts, recurring transaction automation, any notification beyond
transactional email (reset/verification), reports/exports, mobile app,
GraphQL/queues/event streaming, ML-driven categorisation.

---

## How to work on this with the person

- They want to be asked questions, not have assumptions made for them —
  but once they've stated a constraint, don't re-litigate it.
- Prefer thin vertical slices — a story isn't done until it works in a
  browser, frontend included.
- If a story's acceptance criteria and what seems "obviously right"
  conflict, follow the acceptance criteria and flag the tension rather
  than silently picking one.
- Copy/content changes touching Epic 6, 7, or 8 need a tone check against
  the six design principles above before shipping — this is Story 7.6,
  not optional polish.
