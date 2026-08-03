# FinPilot — Full Development Roadmap

This is the detailed phase-by-phase roadmap referenced from `CLAUDE.md`. It is
not loaded automatically every session — pull it in only when planning a new
phase or when full context on a future module is actually needed.

---

## Phase 0 — Product & Architecture

**Status: COMPLETED**

Product vision, PRD, software architecture, technical design, database design,
ERD, project planning, sprint planning.

---

## Phase 1 — Backend Foundation

**Status: MOSTLY COMPLETED** (inspect repo for exact current state)

NestJS, TypeScript, PostgreSQL, Prisma, Docker, configuration, validation,
Swagger, error handling foundation, logging foundation, database migrations.

---

## Phase 2 — Authentication

**Status: IN PROGRESS**

Expected capabilities:

- Registration
- Login
- JWT access tokens
- Refresh tokens + rotation
- Logout
- Authenticated user endpoint
- Email verification (deferred until async infra exists — see Phase 12)
- Password reset (deferred until async infra exists)

---

## Phase 3 — Categories

- Category model (system categories + user categories)
- Income categories / expense categories
- CRUD
- Soft deletion where appropriate
- Ownership rules

---

## Phase 4 — Accounts

- Account CRUD
- Account types: bank, cash, credit card, wallet, UPI, investment account
- Opening balances / current balances
- Currency
- Active/inactive status
- Ownership

---

## Phase 5 — Transactions

One of the most important domains — designed carefully since it affects
financial calculations downstream.

- Income / expense / transfer types
- Create, read, update, delete
- Pagination, filtering, sorting, searching
- Categories, accounts, dates, notes, tags where appropriate

---

## Phase 6 — Balance & Financial Engine

Deterministic financial calculations:

```
Opening Balance
+ Income
- Expenses
+ Transfers In
- Transfers Out
= Current Balance
```

Must remain correct under: concurrent requests, duplicate requests, transaction
edits, transaction deletion, transfers.

---

## Phase 7 — Budgets

- Monthly budgets
- Category budgets
- Budget limits vs actual spending
- Remaining budget / percentage utilization
- Overspending detection

---

## Phase 8 — Dashboard

- Total balance, income, expenses, savings, savings rate
- Budget status
- Recent transactions
- Category spending
- Cash flow

Design dashboard APIs based on actual frontend requirements. Don't introduce
GraphQL automatically — only if aggregation pain actually justifies it.

---

## Phase 9 — Reports & Analytics

- Monthly / yearly spending
- Category breakdown
- Income vs expense
- Savings trend, cash-flow trend
- Account distribution
- Budget trends

Backend provides reliable aggregated data; frontend handles visualization.

---

## Phase 10 — Financial Goals

Examples: emergency fund, vacation, house, car, education, retirement.

- Target amount / current amount / target date
- Contributions
- Progress tracking
- Forecast

---

## Phase 11 — Investments

Design carefully — investment calculations get significantly more complex than
ordinary CRUD.

Potential asset classes: stocks, ETFs, mutual funds, gold, others.

- Holdings
- Investment transactions
- Cost basis
- Portfolio valuation
- Returns
- SIP tracking
- Market price data (keep external market data loosely coupled from core
  transaction management)
- Performance analytics

---

## Phase 12 — Notifications & Async Communication

Introduce a message broker only when this phase is actually reached — not before.

Potential architecture:

```
Application → Domain Event → Message Broker → Worker → External Service
```

Potential events: email verification, password reset, budget exceeded, large
transaction, monthly report, investment notification.

Potential technologies: AWS SQS, SNS, EventBridge, Lambda — choose based on
actual requirements at the time.

---

## Phase 13 — AI Financial Intelligence

- Spending insights
- Budget recommendations
- Savings insights
- Financial trend explanations
- Goal forecasting assistance
- Personalized financial suggestions

AI consumes trusted financial data already computed deterministically by the
app — it does not calculate the numbers itself.

---

## Phase 14 — Production Infrastructure

Introduce AWS incrementally, based on real requirements at the time:

- Networking, compute
- Managed PostgreSQL (RDS)
- Object storage, CDN
- Secrets management
- Logging, monitoring
- Queues, background processing
- CI/CD

---

## Phase 15 — Mobile Applications

Only after web app + backend are mature.

- iOS and Android, consuming the same backend APIs
- Evaluate cross-platform tech (e.g., React Native) at that time — don't decide
  prematurely
- No separate backend unless there's a strong architectural reason

---

## Long-term system shape

```
                         FINPILOT
                            │
            ┌───────────────┼────────────────┐
            │               │                │
            ▼               ▼                ▼
          WEB             iOS            ANDROID
            │               │                │
            └───────────────┼────────────────┘
                            │
                            ▼
                     FINPILOT API
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   PostgreSQL             Redis             AWS Services
        │                                       │
        │                              ┌────────┼────────┐
        │                              │        │        │
        ▼                              ▼        ▼        ▼
 Financial Data                    SQS/SNS   Lambda   Storage
        │
        ▼
 Financial Engine
        │
        ▼
 AI Financial Intelligence
```

Golden rule: build the simplest architecture that correctly solves the current
problem while keeping the system extensible. Optimize for correctness, security,
maintainability, scalability, developer experience, user experience, and
financial accuracy — not technology count.
