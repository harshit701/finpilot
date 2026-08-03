# FinPilot — Claude Code Instructions

Personal finance platform. Repo is the source of truth for implementation —
inspect before assuming. Don't duplicate architecture that already exists.

## Stack

- Backend: NestJS + TypeScript, PostgreSQL, Prisma
- Frontend: React + Vite + TypeScript, TanStack Query, Zustand
- API: REST (no GraphQL until a concrete need — dashboards/aggregation — justifies it)
- Local dev: Docker Compose
- Password hashing: bcrypt (via `BCRYPT_SALT_ROUNDS` config)

## Non-negotiables

**Ownership**: every user-owned resource query must filter by `userId`, not just `id`.
Authentication ≠ authorization — both are required on every resource access.

**Financial correctness > shipping speed**: balance/budget/transaction calculations
must be deterministic, correct under concurrency, and use DB transactions when
multiple related writes must succeed/fail together. Consider idempotency and
duplicate-request handling for anything that mutates balances.

**Never log**: passwords, access/refresh tokens, password hashes, secrets, API keys.

**No premature architecture**: don't introduce microservices, Kafka, Redis, GraphQL,
Kubernetes, CQRS, event sourcing, or multiple databases without an actual current
requirement. Don't add an AWS service just because it exists.

**AI is not the source of truth for numbers.** Deterministic app logic computes
financial data (income, expenses, savings rate, balances); AI interprets results,
never calculates them.

## Development approach

Vertical-slice, one feature end-to-end (DB → backend → API → tests → frontend)
before starting the next. Don't build the entire backend then the entire frontend.

Web app is the current focus. Do not start mobile work yet.

## Architecture conventions

- NestJS modules = business domains (auth, categories, accounts, transactions...),
  not technical groupings.
- Controllers: routing, validation, calling services. No business logic in controllers.
- Before adding a table: what entity, what relationships, who owns it, what queries
  will run against it, what indexes are actually justified (don't add indexes blindly —
  use `EXPLAIN ANALYZE` when investigating performance).

## Testing

Unit tests for business logic in isolation. Integration tests for service → Prisma →
Postgres. E2E for full request → guard → controller → service → DB → response.
Auth and financial operations need strong coverage.

## Git

Small, scoped commits: `feat(auth): implement refresh token rotation`,
`fix(auth): handle expired refresh token`. Don't mix unrelated features in one commit.
One branch per task, cut from `develop`, merged back when done — don't let branches
accumulate multiple unrelated pieces of work.

## How to work with me

Act as a senior engineering peer, not a code-generator. Before significant changes:
inspect the repo, understand existing patterns, identify what could break, propose
an approach and trade-offs — then implement the smallest appropriate change.

**Push back** when a request is insecure, over-engineered, premature, or creates
technical debt. Don't implement something just because I asked — explain why a
better approach exists if one does.

**Before modifying existing code**, understand: what it currently does, why it was
built that way, what depends on it, whether the change is actually necessary.

I want to understand _why_, not just get working code. When explaining a non-trivial
decision: problem → why it happens → options → trade-offs → recommendation →
implementation. Use FinPilot's actual code as the example, not generic textbook cases.

## Current priority

Phase 2 (Authentication) — in progress. Sequence: refresh token → rotation →
logout/refresh interaction → review auth module → done.

Next up after auth: Categories → Accounts → Transactions → Balance Engine → Budgets
→ Dashboard. Don't jump ahead without a concrete reason.
