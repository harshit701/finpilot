# FinPilot — Claude Code Project Instructions

## 1. Purpose of This File

This file provides the product vision, engineering philosophy, architectural direction, development roadmap, and collaboration rules for FinPilot.

The repository itself is the source of truth for implementation details.

Before making changes, inspect the existing repository and understand the current implementation rather than assuming that the implementation matches this document.

Do not recreate or duplicate architecture that already exists in the repository.

---

# 2. What is FinPilot?

FinPilot is a personal finance management and financial intelligence platform.

The initial goal is to help an individual understand and manage their complete financial life from one application.

FinPilot should eventually help users answer questions such as:

- Where is my money going?
- How much can I safely spend?
- Am I staying within my budget?
- How much am I saving every month?
- What are my biggest spending categories?
- How are my investments performing?
- Am I progressing toward my financial goals?
- What financial decisions could improve my financial position?
- What should I change based on my financial behavior?

FinPilot should evolve from a financial tracking application into a personal financial co-pilot.

The long-term progression is:

    Financial Tracking
            ↓
    Financial Understanding
            ↓
    Financial Planning
            ↓
    Financial Intelligence
            ↓
    Personal Financial Co-Pilot

---

# 3. Product Vision

The vision of FinPilot is:

> Help people understand their money, make better financial decisions, and build long-term financial stability through intelligent, personalized financial guidance.

The product should not merely display financial data.

It should progressively transform financial data into useful information, insights, recommendations, and eventually intelligent financial assistance.

---

# 4. Product Philosophy

FinPilot should prioritize:

- Simplicity
- Accuracy
- Security
- Trust
- Explainability
- Maintainability
- Performance
- Good user experience
- Financial correctness

Financial applications are different from ordinary CRUD applications.

Incorrect calculations, incorrect balances, incorrect ownership checks, or incorrect financial recommendations can cause serious problems.

Therefore, financial correctness and data integrity are more important than quickly shipping features.

---

# 5. Target Users

The initial product is focused on individual users managing their personal finances.

Typical users may have:

- Multiple bank accounts
- Savings accounts
- Current accounts
- Cash
- Credit cards
- Wallets
- UPI accounts
- Investments
- Monthly income
- Recurring expenses
- Budgets
- Financial goals

The first version should focus on individual personal finance.

Do not prematurely design the system as an enterprise accounting platform.

---

# 6. Product Scope

The long-term product will contain modules such as:

    FinPilot
    │
    ├── Authentication
    ├── User Management
    ├── Categories
    ├── Accounts
    ├── Transactions
    ├── Budgets
    ├── Dashboard
    ├── Reports & Analytics
    ├── Financial Goals
    ├── Investments
    ├── Notifications
    ├── AI Financial Insights
    └── Administration

These modules should be introduced incrementally.

Do not implement all modules at once.

---

# 7. Technology Direction

The current primary technology direction is:

## Backend

- Node.js
- TypeScript
- NestJS

## Database

- PostgreSQL

## ORM

- Prisma

## Local Development

- Docker / Docker Compose

## Web Frontend

- React
- TypeScript
- Vite

## API

- REST as the primary API architecture

## Cloud / Infrastructure

AWS will be introduced progressively when the application requires production infrastructure.

Potential AWS services may include:

- API Gateway
- Lambda
- ECS/Fargate
- S3
- CloudFront
- Route 53
- RDS PostgreSQL
- ElastiCache / Redis
- SQS
- SNS
- EventBridge
- CloudWatch
- Secrets Manager
- IAM

Do not introduce an AWS service merely because it is available.

Every infrastructure component must solve an actual problem.

---

# 8. REST vs GraphQL

REST is the default API architecture for FinPilot.

GraphQL is intentionally NOT a requirement for the initial version.

GraphQL may be introduced later if actual application requirements justify it.

Potential use cases could include:

- Complex dashboards
- Aggregated financial views
- Multiple related resources
- Frontend data composition
- Avoiding excessive API calls
- Different clients requiring different representations of data

Do not introduce GraphQL simply because it is popular.

If GraphQL is eventually introduced, it should coexist with REST intentionally.

Do not replace working REST APIs with GraphQL without a strong architectural reason.

---

# 9. Development Strategy

FinPilot must be developed using a vertical-slice / feature-by-feature approach.

Do NOT build the entire backend first and then the entire frontend.

Instead:

    Feature
       ↓
    Database
       ↓
    Backend
       ↓
    API
       ↓
    Tests
       ↓
    Frontend
       ↓
    Integration
       ↓
    Production readiness
       ↓
    Next Feature

For example:

    Categories
      ├── Database
      ├── Backend
      ├── API
      ├── Tests
      └── Frontend

            ↓

    Accounts
      ├── Database
      ├── Backend
      ├── API
      ├── Tests
      └── Frontend

            ↓

    Transactions
      ├── Database
      ├── Backend
      ├── API
      ├── Tests
      └── Frontend

This approach should allow every completed feature to be usable end-to-end.

---

# 10. Current Development Priority

The immediate priority is the WEB APPLICATION.

The development order should be:

    Backend foundation
          ↓
    Authentication
          ↓
    Core financial features
          ↓
    Dashboard & reporting
          ↓
    Investment management
          ↓
    AI capabilities
          ↓
    Production infrastructure
          ↓
    Mobile applications

Do not start mobile application development while the core web application is still being built.

---

# 11. Web Application

The web application is the primary product surface for the initial development phase.

The web application should eventually provide:

- Authentication
- User profile
- Accounts
- Transactions
- Categories
- Budgets
- Dashboard
- Reports
- Financial goals
- Investments
- Notifications
- AI financial insights

The frontend should consume the backend APIs rather than embedding business logic that belongs on the server.

---

# 12. Future Mobile Applications

After the web application is mature and the core product architecture is stable, FinPilot should eventually have:

- iOS application
- Android application

The mobile applications should provide functionality comparable to the web application where appropriate.

The goal is not to create a separate product.

The goal is:

    FinPilot Backend
          │
          ├────────────── Web Application
          │
          ├────────────── iOS Application
          │
          └────────────── Android Application

The backend should therefore remain client-agnostic.

Do not design backend APIs specifically for the web if the same domain functionality will eventually be consumed by mobile applications.

When mobile development begins, evaluate whether a cross-platform technology such as React Native is appropriate based on the state of the project at that time.

Do not make the mobile technology decision prematurely.

---

# 13. Backend Architecture Philosophy

The backend should be modular and domain-oriented.

NestJS modules should represent meaningful business domains rather than arbitrary technical groupings.

For example:

    auth
    users
    categories
    accounts
    transactions
    budgets
    goals
    investments
    notifications
    insights

Avoid creating a giant service or controller containing unrelated business logic.

Business logic should live in appropriate services.

Controllers should primarily handle:

- HTTP routing
- Request validation
- Authentication context
- Calling application services
- Returning responses

Do not place substantial business logic inside controllers.

---

# 14. Database Philosophy

PostgreSQL is the primary source of truth for transactional financial data.

Database design should prioritize:

- Data integrity
- Referential integrity
- Constraints
- Correct relationships
- Transactions
- Appropriate indexes
- Query performance
- Auditability where appropriate

Before adding a table, understand:

1. What domain entity does it represent?
2. What relationships does it have?
3. Who owns the data?
4. What are the lifecycle rules?
5. What queries will be executed?
6. What constraints are required?
7. What indexes are actually justified?

Do not create indexes blindly.

When investigating performance, use actual measurements and database tools such as:

    EXPLAIN
    EXPLAIN ANALYZE

Performance decisions should be evidence-driven.

---

# 15. Financial Data Integrity

Financial operations must be treated carefully.

Examples:

- Account balances
- Transactions
- Transfers
- Budget calculations
- Investment holdings
- Investment performance
- Financial goals

Avoid calculations that can produce inconsistent financial states.

Where appropriate, use database transactions to ensure multiple related changes succeed or fail together.

Always consider:

- Concurrency
- Duplicate requests
- Idempotency
- Race conditions
- Partial failures
- Transaction boundaries

---

# 16. Ownership & Authorization

Every user-owned resource must enforce ownership.

For example, a transaction belonging to User A must never be accessible or modifiable by User B.

Prefer queries that enforce ownership directly:

    where:
      id: transactionId
      userId: currentUserId

Do not fetch a resource only by ID and assume that authentication alone guarantees ownership.

Authentication answers:

> Who is this user?

Authorization answers:

> Is this user allowed to access this resource?

Both are required.

---

# 17. Security Philosophy

Security must be considered from the beginning.

Important areas include:

- Password hashing
- JWT authentication
- Refresh token security
- Refresh token rotation
- Token expiration
- Input validation
- Authorization
- Rate limiting
- CORS
- Secure HTTP headers
- Secrets management
- Database security
- Sensitive data handling
- Logging without leaking secrets
- API abuse prevention

Never log:

- Passwords
- Access tokens
- Refresh tokens
- Password hashes
- Secrets
- API keys

---

# 18. Authentication

Authentication already exists in the repository.

Claude Code MUST inspect the current authentication implementation before making authentication changes.

Do not assume that the implementation matches this document.

When working on authentication:

- Inspect the current controllers.
- Inspect services.
- Inspect DTOs.
- Inspect guards.
- Inspect strategies.
- Inspect decorators.
- Inspect JWT configuration.
- Inspect Prisma models.
- Inspect migrations.
- Inspect tests.

Understand the existing implementation first.

---

# 19. Authentication Roadmap

The authentication domain should eventually support:

    Register
       ↓
    Login
       ↓
    Access Token
       ↓
    Authenticated Requests
       ↓
    Refresh Token
       ↓
    Logout
       ↓
    Email Verification
       ↓
    Password Reset
       ↓
    Session / Device Management

Email verification is intentionally postponed until asynchronous communication infrastructure is introduced.

Do not introduce a message broker solely for email verification at this stage.

---

# 20. Async Architecture

As the application grows, asynchronous communication should be introduced where it provides real value.

Potential future architecture:

    Application
        ↓
    Domain Event
        ↓
    Message Broker
        ↓
    Worker
        ↓
    External Service

Potential use cases:

- Email verification
- Password reset emails
- Budget alerts
- Transaction notifications
- Monthly financial reports
- Investment alerts
- AI processing
- Background financial calculations

Potential technologies include:

- AWS SQS
- AWS SNS
- EventBridge
- Lambda

The specific technology should be chosen based on requirements.

Do not introduce event-driven architecture everywhere.

Use synchronous communication where synchronous communication is sufficient.

---

# 21. AI Strategy

AI is a long-term differentiator for FinPilot.

AI should not replace deterministic financial calculations.

For example:

The application should calculate:

    Monthly income
    Monthly expenses
    Savings rate
    Portfolio value
    Budget utilization

using deterministic application logic.

AI can then interpret those results.

Example:

    Financial Engine
          ↓
    Trusted Financial Data
          ↓
    AI
          ↓
    Personalized Insight

AI should not be treated as the source of truth for numerical financial calculations.

AI recommendations should be:

- Explainable
- Based on actual user data
- Clearly separated from deterministic calculations
- Appropriately caveated
- Auditable where practical

---

# 22. Investment Module

Investment functionality should be introduced after the core personal-finance system is stable.

Potential asset classes:

- Stocks
- ETFs
- Mutual funds
- Gold
- Other supported investments

The investment domain may eventually require:

- Holdings
- Investment transactions
- Cost basis
- Portfolio valuation
- Returns
- SIP tracking
- Market price data
- Performance analytics

External market data should not be tightly coupled to core transaction management.

---

# 23. Development Roadmap

## Phase 0 — Product & Architecture

Status:

    COMPLETED

Includes:

- Product vision
- PRD
- Software Architecture
- Technical Design
- Database Design
- ERD
- Project planning
- Sprint planning

---

## Phase 1 — Backend Foundation

Status:

    MOSTLY COMPLETED

Includes:

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Docker
- Configuration
- Validation
- Swagger
- Error handling foundation
- Logging foundation
- Database migrations

Claude must inspect the repository to determine the exact current state.

---

## Phase 2 — Authentication

Status:

    IN PROGRESS

Expected capabilities:

- Registration
- Login
- JWT access tokens
- Refresh tokens
- Refresh token rotation
- Logout
- Authenticated user endpoint
- Email verification
- Password reset

Email verification and password reset may be implemented later when asynchronous communication is introduced.

---

## Phase 3 — Categories

Build:

- Category model
- System categories
- User categories
- Income categories
- Expense categories
- CRUD
- Soft deletion where appropriate
- Ownership rules

---

## Phase 4 — Accounts

Build:

- Account CRUD
- Account types
- Opening balances
- Current balances
- Currency
- Active/inactive status
- Ownership

Examples:

- Bank account
- Cash
- Credit card
- Wallet
- UPI
- Investment account

---

## Phase 5 — Transactions

This is one of the most important domains.

Support:

- Income
- Expense
- Transfer

Features:

- Create
- Read
- Update
- Delete
- Pagination
- Filtering
- Sorting
- Searching
- Categories
- Accounts
- Dates
- Notes
- Tags where appropriate

Transactions must be designed carefully because they affect financial calculations.

---

## Phase 6 — Balance & Financial Engine

Build deterministic financial calculations.

Examples:

    Opening Balance
    + Income
    - Expenses
    + Transfers In
    - Transfers Out
    = Current Balance

Ensure calculations remain correct under:

- Concurrent requests
- Duplicate requests
- Transaction edits
- Transaction deletion
- Transfers

---

## Phase 7 — Budgets

Support:

- Monthly budgets
- Category budgets
- Budget limits
- Actual spending
- Remaining budget
- Percentage utilization
- Overspending detection

---

## Phase 8 — Dashboard

Provide:

- Total balance
- Income
- Expenses
- Savings
- Savings rate
- Budget status
- Recent transactions
- Category spending
- Cash flow

Dashboard APIs should be designed based on actual frontend requirements.

Do not introduce GraphQL automatically.

---

## Phase 9 — Reports & Analytics

Examples:

- Monthly spending
- Yearly spending
- Category breakdown
- Income vs expense
- Savings trend
- Cash-flow trend
- Account distribution
- Budget trends

Backend should provide reliable aggregated data.

Frontend should handle visualization.

---

## Phase 10 — Financial Goals

Examples:

- Emergency fund
- Vacation
- House
- Car
- Education
- Retirement

Features:

- Target amount
- Current amount
- Target date
- Contributions
- Progress
- Forecast

---

## Phase 11 — Investments

Introduce:

- Holdings
- Investment transactions
- Portfolio
- Performance
- SIP tracking
- Market data integration

This phase should be designed carefully because investment calculations can become significantly more complex than ordinary CRUD.

---

## Phase 12 — Notifications & Async Communication

Introduce:

- Message broker
- Background workers
- Email provider
- Notifications

Potential events:

- Email verification
- Password reset
- Budget exceeded
- Large transaction
- Monthly report
- Investment notification

---

## Phase 13 — AI Financial Intelligence

Build:

- Spending insights
- Budget recommendations
- Savings insights
- Financial trend explanations
- Goal forecasting assistance
- Personalized financial suggestions

AI should consume trusted financial information produced by the application.

---

## Phase 14 — Production Infrastructure

Introduce AWS production infrastructure incrementally.

Potential components:

- Networking
- Compute
- PostgreSQL
- Object storage
- CDN
- Secrets management
- Logging
- Monitoring
- Queues
- Background processing
- CI/CD

The final infrastructure should be based on real application requirements.

---

## Phase 15 — Mobile Applications

Only after the web application and backend have reached a mature state.

Build:

- iOS application
- Android application

The mobile applications should consume the same backend APIs.

Evaluate cross-platform development at that stage.

The mobile applications should not require a separate backend unless there is a strong architectural reason.

---

# 24. Testing Strategy

Every significant feature should have appropriate tests.

## Unit Tests

Test business logic in isolation.

## Integration Tests

Test interactions between:

    Service
       ↓
    Prisma
       ↓
    PostgreSQL

## E2E Tests

Test:

    HTTP Request
       ↓
    Guard
       ↓
    Controller
       ↓
    Service
       ↓
    Database
       ↓
    HTTP Response

Financial operations and authentication should receive strong test coverage.

---

# 25. Definition of Done

A feature is not considered complete merely because the API works.

A feature should generally reach:

    Requirement
       ↓
    Domain Design
       ↓
    Database
       ↓
    Migration
       ↓
    Backend
       ↓
    Validation
       ↓
    Authorization
       ↓
    Error Handling
       ↓
    Tests
       ↓
    API Documentation
       ↓
    Performance Review
       ↓
    Frontend
       ↓
    Integration
       ↓
    Production Readiness

Not every step needs to be equally heavy for every feature.

Use engineering judgment.

---

# 26. Performance Philosophy

Always:

    Measure
       ↓
    Identify Bottleneck
       ↓
    Understand Cause
       ↓
    Optimize
       ↓
    Measure Again

Do not optimize based purely on assumptions.

For database performance:

- Inspect query plans.
- Check indexes.
- Check connection behavior.
- Check query duration.
- Check database load.
- Check application overhead.

For API performance consider:

- Database latency
- Network latency
- Serialization
- External API calls
- Password hashing
- CPU
- Memory
- Event-loop blocking
- Connection pools

---

# 27. Observability

Eventually the application should provide:

- Structured logging
- Request IDs
- Error tracking
- Metrics
- API latency
- Database latency
- Background job metrics
- Queue metrics
- Authentication failures
- Security events

Do not log sensitive information.

---

# 28. Git & Change Management

Prefer small, meaningful commits.

Examples:

    feat(auth): implement refresh token rotation

    feat(categories): add category management

    feat(accounts): add account management

    feat(transactions): add transaction creation

    fix(auth): handle expired refresh token

    perf(auth): optimize login flow

Avoid mixing unrelated features in one commit.

---

# 29. How Claude Code Should Work

Claude Code should behave as a senior software engineer and engineering peer.

It should NOT behave as a code generator that blindly implements every request.

Before making significant changes:

1. Inspect the repository.
2. Understand the existing architecture.
3. Identify affected modules.
4. Identify existing patterns.
5. Identify potential risks.
6. Propose an implementation approach.
7. Explain important trade-offs.
8. Implement the smallest appropriate change.
9. Run relevant tests.
10. Run build/lint/type checks where applicable.
11. Review the implementation.
12. Report what changed.
13. Identify the next logical step.

---

# 30. Claude Code Must Challenge Bad Decisions

Claude should challenge proposed decisions when they are:

- Insecure
- Over-engineered
- Premature
- Inconsistent
- Difficult to maintain
- Unnecessarily expensive
- Likely to create technical debt
- Based on incorrect assumptions

Do not agree with a proposed implementation merely because the developer requested it.

If there is a better approach, explain why.

For architectural decisions, discuss:

    Problem
       ↓
    Why it exists
       ↓
    Constraints
       ↓
    Possible solutions
       ↓
    Trade-offs
       ↓
    Recommended solution

---

# 31. Claude Code Must Understand Before Changing

Before modifying existing code, Claude should answer internally:

- What does this code currently do?
- Why was it designed this way?
- What depends on it?
- What could break if it changes?
- Is the requested change actually necessary?
- Is there an existing abstraction that should be reused?

Avoid rewriting working code unnecessarily.

---

# 32. No Premature Architecture

Do not introduce:

- Microservices
- Kafka
- Redis
- GraphQL
- Kubernetes
- Complex event sourcing
- CQRS
- Multiple databases
- Complex AWS infrastructure

unless an actual requirement justifies them.

The goal is to build a production-quality system, not a collection of technologies.

---

# 33. Repository Is the Source of Truth

This document describes:

- Vision
- Direction
- Principles
- Roadmap

The repository describes:

- Actual implementation
- Current code
- Actual database schema
- Current dependencies
- Existing APIs
- Existing architecture

When there is a discrepancy, inspect the repository and raise the discrepancy rather than blindly overwriting existing implementation.

---

# 34. Working Style With the Developer

The developer wants to deeply understand the engineering decisions rather than blindly copy code.

When explaining an important technical decision, prefer:

    Problem
       ↓
    Why it happens
       ↓
    Request / system flow
       ↓
    Possible solutions
       ↓
    Trade-offs
       ↓
    Recommended solution
       ↓
    Implementation
       ↓
    Testing
       ↓
    Possible follow-up questions

Avoid explaining concepts only as definitions.

Use realistic scenarios from FinPilot whenever possible.

---

# 35. Current Priority

The current development task is to complete authentication.

The immediate sequence is:

    Complete Refresh Token
           ↓
    Test Refresh Token Rotation
           ↓
    Verify Logout + Refresh interaction
           ↓
    Review Authentication Module
           ↓
    Authentication Complete
           ↓
    Categories
           ↓
    Accounts
           ↓
    Transactions
           ↓
    Balance Engine
           ↓
    Budgets
           ↓
    Dashboard
           ↓
    Reports
           ↓
    Goals
           ↓
    Investments
           ↓
    Notifications
           ↓
    AI
           ↓
    Production
           ↓
    Mobile

Do not jump ahead without a concrete reason.

---

# 36. Final Objective

The objective is to build FinPilot as a complete, production-oriented application from the ground up.

The final ecosystem should look conceptually like:

```text
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

The web application is the immediate priority.

iOS and Android are future clients of the same FinPilot platform.

The architecture should therefore be designed with a clean separation between:

- Client
- API
- Domain/business logic
- Persistence
- Infrastructure
- AI capabilities

while avoiding unnecessary complexity until the product actually requires it.

---

# 37. Golden Rule

Build the simplest architecture that correctly solves the current problem while keeping the system extensible for the future.

Do not optimize for technology count.

Optimize for:

    Correctness
    Security
    Maintainability
    Scalability
    Developer Experience
    User Experience
    Financial Accuracy
