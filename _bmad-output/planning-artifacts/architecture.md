---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-20'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-incubyte-assesment-2026-06-20/prd.md
  - _bmad-output/planning-artifacts/prds/prd-incubyte-assesment-2026-06-20/addendum.md
workflowType: 'architecture'
project_name: 'incubyte-assesment'
user_name: 'Empire'
date: '2026-06-20'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 20 FRs across 6 feature groups:
- Auth & RBAC (FR-1–4): JWT auth, refresh tokens, rate limiting, 3 roles
- Employee Management (FR-5–8): CRUD, soft-delete, search/filter/pagination
- Salary Records (FR-9–11): Append-only versioned history, configurable alert
- Analytics Dashboard (FR-12–16): Aggregations, inactive toggle, filter presets, CSV export
- Audit Log (FR-17–19): Immutable capture, retention, S3 NDJSON archival
- System Settings (FR-20): Runtime-configurable platform parameters

**Non-Functional Requirements:**
- Employee search < 5 seconds on 10,000 rows (requires DB indexing)
- Analytics renders < 3 seconds (SQL-level aggregation, not application-layer)
- Auth rate limiting: 5 failures / 5 min / IP
- Audit entries immutable via API (no DELETE/UPDATE endpoints on audit table)
- Unit test coverage ≥80% of backend domain logic
- Safe-delete archival: S3 upload confirmed before DB row deletion

**Scale & Complexity:**
- Complexity level: Medium
- Primary domain: Full-stack web (REST API + Next.js)
- Data volume: ~10,000 employees, moderate; SQLite sufficient for dev
- Single-tenant, single-org

### Technical Constraints & Dependencies

- Backend: Node.js + Express, TypeScript strict mode
- ORM: Prisma (SQLite dev → PostgreSQL prod)
- Frontend: Next.js (App Router), shadcn/ui
- Auth: JWT (access 15min, refresh 7-day httpOnly), bcrypt
- S3: AWS SDK v3, credentials via env vars only
- Monetary values: Prisma `Decimal` type (Decimal.js), never JS float

### Cross-Cutting Concerns Identified

1. Auth middleware — JWT validation, token refresh
2. RBAC middleware — composable role guards per route
3. Audit capture — service-layer pattern, fires on every mutation
4. Soft-delete filtering — `where: { status: 'active' }` default on all employee queries
5. Decimal handling — monetary values never touch JS number primitives
6. Error response shape — consistent envelope across all endpoints
7. Pagination — uniform page/limit pattern
8. Background job — daily archival isolated from HTTP server
9. Settings cache — DB-sourced runtime config with cache invalidation

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application — decoupled Express REST API + Next.js frontend, co-located in a Turborepo monorepo.

### Starter Options Considered

| Option | Verdict |
|--------|---------|
| Turborepo monorepo (create-turbo) | ✅ Selected |
| Separate repos | ❌ Single repo required for assessment submission |
| Next.js API routes only | ❌ Violates Express backend constraint |

### Selected Starter: Turborepo Monorepo

**Rationale:** Single git repository satisfies the assessment's incremental-commit requirement. Shared `packages/` enables type-safe contracts between frontend and backend without duplication. Turborepo's task pipeline handles build ordering and caches test/build outputs.

**Project Structure:**
```
/
├── apps/
│   ├── web/          ← Next.js 16 (App Router, Tailwind, shadcn/ui)
│   └── api/          ← Express 5 (TypeScript, Prisma, Vitest)
├── packages/
│   └── types/        ← Shared TypeScript types (Employee, Salary, etc.)
├── turbo.json
└── package.json      ← pnpm workspace root
```

**Initialization Commands:**
```bash
# 1. Scaffold monorepo
npx create-turbo@latest acme-salary-mgmt -m pnpm

# 2. Replace apps/web with Next.js 16
cd apps/web
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# 3. Add shadcn/ui
npx shadcn@latest init

# 4. Initialize Prisma in apps/api
cd ../api
npm install prisma@7.3.0 --save-dev
npx prisma init
```

**Architectural Decisions Established by Starter:**

| Decision | Value |
|----------|-------|
| Language | TypeScript strict mode (both apps) |
| Package manager | pnpm (workspaces) |
| Frontend bundler | Turbopack (Next.js 16 default) |
| Backend runner | tsx 4.22.4 (not ts-node — actively maintained) |
| Testing framework | Vitest 4.1.9 (API); Vitest (web) |
| Linting | ESLint (Next.js config) + custom for API |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma 7.3.0 |
| Express version | 5.2.1 (Express 5, now npm default since March 2025) |

**Note:** Express 5 has native async error handling — no need for `express-async-errors` wrapper.

**Note:** Project initialization using these commands is the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Zod as shared validation layer (API + frontend share schemas via `packages/types`)
- Prisma Migrate for schema versioning
- `/api/v1/` prefix on all backend routes
- TanStack Query v5 for client-side data fetching
- node-cron for daily audit archival job (inside API process)

**Important Decisions (Shape Architecture):**
- pino v9 for structured JSON logging
- React Hook Form v7 + Zod resolver for all forms
- TanStack Table v8 (shadcn DataTable) for all tabular data
- Recharts v2 for analytics charts
- `@t3-oss/env-core` for env var validation at startup
- Railway (API + PostgreSQL) + Vercel (web) for deployment

**Deferred Decisions (Post-MVP):**
- Redis for distributed rate limiting (in-memory sufficient for single server)
- Separate worker process for archival job (node-cron in-process is fine for assessment)
- Cloudflare R2 vs AWS S3 (both S3-compatible; use S3 for now)

### Data Architecture

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| Migrations | Prisma Migrate | Prisma 7.3.0 | Integrated, SQL files version-controlled |
| Soft-delete | `status` enum (`ACTIVE`/`INACTIVE`) on Employee | — | Simple, queryable, no middleware magic |
| Decimal handling | Prisma `Decimal` type + `Decimal.js` in app code | — | Monetary values never touch JS `number` |
| Settings cache | In-process `Map` with TTL (no Redis) | — | Single-server; 4 settings; Redis is overkill |
| Seed tool | `prisma db seed` + `@faker-js/faker` v9 | faker v9 | Native Prisma hook; realistic data generation |

### Authentication & Security

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| Input validation | Zod (shared in `packages/types`) | Zod v3 | TypeScript-native; schema = type; shared API↔frontend |
| Rate limiting | `express-rate-limit` (in-memory store) | v7 | No Redis dep; sufficient for single-server |
| CORS | Restrictive — allow `NEXT_PUBLIC_WEB_URL` origin only | — | No arbitrary origin access |
| JWT secret | `JWT_SECRET` env var, 256-bit minimum | — | Never in code |
| Password rules | Min 8 chars, bcrypt 12 rounds | bcrypt v5 | Security vs. seed script performance balance |

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API versioning | `/api/v1/` prefix on all routes | Future-proofs without complexity |
| Error envelope | `{ success: bool, error?: { code, message, details? } }` | Consistent; frontend type-narrows on `success` |
| Request validation | Zod middleware on all routes (body + query params) | Fails fast with 422 + field-level errors |
| API documentation | OpenAPI via `zod-to-openapi` → Swagger UI at `/api/docs` | Assessment artifact; demonstrates API contract |
| HTTP client (web→api) | Native `fetch` with typed wrapper in `packages/types` | No axios dep; RSC-compatible |

### Frontend Architecture

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| Data fetching | TanStack Query v5 (client); RSC fetch (server) | TanStack Query v5 | Caching, loading/error states, refetch out of the box |
| Forms | React Hook Form v7 + Zod resolver | RHF v7 | shadcn/ui `<Form>` is built on RHF; Zod already in project |
| Data tables | TanStack Table v8 (shadcn `<DataTable>`) | TanStack Table v8 | Employee list, salary history, audit log all need sortable/paginated tables |
| Charts | Recharts v2 | Recharts v2 | Lightweight; shadcn/ui charts are Recharts-based |
| Filter preset persistence | DB table (`user_filter_presets`) + TanStack Query cache | — | Per-user, server-persisted, client-cached |
| State management | None (no Zustand/Redux) | — | App Router server components + TanStack Query handle all state needs |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API hosting | Railway | One-click Node.js deploy, free tier, co-located PostgreSQL |
| Web hosting | Vercel | Natural Next.js platform, auto-deploy from git |
| Database (prod) | Railway PostgreSQL | Co-located with API, no network latency |
| S3 archival | AWS S3 | PRD specifies S3; Cloudflare R2 is drop-in alternative if cost matters |
| Background job | node-cron (inside API process) | No separate worker infra; sufficient for daily archival |
| Logging | pino v9 (structured JSON) | Fast, lightweight, production-ready |
| Env validation | `@t3-oss/env-core` + Zod | Crashes at startup on misconfiguration; Zod already in project |
| CI/CD | GitHub Actions | Free; runs lint + test + build on every PR |

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo scaffold + shared `packages/types` with Zod schemas
2. Prisma schema + migrations (data model is the foundation)
3. Auth middleware (every other feature depends on it)
4. RBAC middleware (composes with auth)
5. Employee CRUD API + audit capture service
6. Salary records API
7. Analytics API (aggregation queries)
8. System Settings API + settings cache
9. Audit archival job (node-cron)
10. Next.js frontend (consumes completed API)
11. Seed script (10,000 employees)
12. Deploy (Railway + Vercel)

**Cross-Component Dependencies:**
- Zod schemas in `packages/types` are shared by API (validation) and web (form validation + type safety)
- Auth middleware must be in place before any other API endpoint is testable
- Audit capture service must wrap all mutation service methods (not route handlers)
- Settings cache must initialize before the audit archival job scheduler starts
- Prisma schema drives both TypeScript types (via `prisma generate`) and DB migrations

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

9 areas where AI agents could make incompatible choices without explicit rules.

### Naming Patterns

**Database / Prisma:**
- Model names: PascalCase singular (`Employee`, `SalaryRecord`, `AuditLog`)
- DB column names: snake_case (Prisma maps automatically via `@map`)
- Foreign keys: `employeeId` in Prisma schema → `employee_id` in DB
- Index names: `@@index([fieldName])` — let Prisma generate index names

**API Endpoints:**
- Resource names: plural nouns — `/api/v1/employees`, `/api/v1/salary-records`
- Route params: `:id` (never `{id}`)
- Query params: camelCase (`?sortBy=lastName&pageSize=50`)
- Nested resources: `/api/v1/employees/:id/salary-history` (max 2 levels deep)

**TypeScript Code:**
- Variables & functions: camelCase (`employeeId`, `getSalaryHistory`)
- Types, interfaces, classes: PascalCase (`Employee`, `SalaryRecord`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_PAGE_SIZE`, `JWT_EXPIRY_MS`)
- Zod schemas: camelCase with `Schema` suffix (`employeeSchema`, `createSalarySchema`)
- React components: PascalCase (`EmployeeTable`, `SalaryHistoryDrawer`)

**Files & Directories:**
- API feature files: kebab-case (`employee.service.ts`, `salary.routes.ts`)
- React components: PascalCase (`EmployeeTable.tsx`)
- Test files: co-located, same name + `.test.ts` (`employee.service.test.ts`)
- Hooks: `use` prefix, camelCase (`useEmployees.ts`, `useSalaryHistory.ts`)

### Structure Patterns

**API Layer (`apps/api/src/`):**
```
features/
  employees/
    employee.routes.ts      ← Express Router, validation middleware only
    employee.service.ts     ← Business logic, calls audit
    employee.schema.ts      ← Zod schemas for this feature
    employee.service.test.ts
  salary-records/
  audit-log/
  system-settings/
  auth/
lib/
  prisma.ts                ← Single Prisma client instance (singleton)
  audit.ts                 ← AuditService used by all feature services
  settings-cache.ts        ← In-process settings Map with TTL
  errors.ts                ← AppError class + error middleware
  jwt.ts                   ← Token sign/verify helpers
middleware/
  auth.middleware.ts       ← JWT validation
  rbac.middleware.ts       ← Role guard factory
  validate.middleware.ts   ← Zod request validation
jobs/
  audit-archival.job.ts    ← node-cron job
```

**Frontend Layer (`apps/web/src/`):**
```
app/                       ← Next.js App Router pages
  (auth)/login/
  dashboard/
  employees/
  analytics/
  audit-log/
  settings/
components/
  ui/                      ← shadcn/ui primitives (auto-generated, do not edit)
  employees/               ← Feature components
  analytics/
  shared/                  ← Reusable across features
hooks/                     ← TanStack Query hooks per feature
lib/
  api.ts                   ← Typed fetch wrapper (base URL, auth headers)
  query-client.ts          ← TanStack QueryClient singleton
```

**Shared Package (`packages/types/src/`):**
```
schemas/
  employee.schema.ts       ← Zod schemas shared by API + web
  salary.schema.ts
  auth.schema.ts
  pagination.schema.ts
types/
  index.ts                 ← Inferred types from schemas (z.infer<>)
```

### Format Patterns

**API Success Response:**
```typescript
{ success: true, data: T }
// Paginated
{ success: true, data: T[], meta: { page, limit, total, totalPages } }
```

**API Error Response:**
```typescript
{ success: false, error: { code: string, message: string, details?: Record<string, string[]> } }
// code examples: "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED", "FORBIDDEN", "CONFLICT"
```

**HTTP Status Codes (strict mapping):**
- 200: GET success, UPDATE success
- 201: POST (resource created)
- 204: DELETE/deactivate success (no body)
- 401: Not authenticated
- 403: Authenticated but wrong role
- 404: Resource not found
- 409: Conflict (duplicate email/employeeId)
- 422: Validation failure (valid JSON, invalid data)
- 429: Rate limit exceeded
- 500: Unhandled server error

**Dates:** ISO 8601 UTC strings in all API responses (`"2026-06-20T10:30:00.000Z"`). Format for display at render time using `Intl.DateTimeFormat`. Never store formatted strings.

**JSON field naming:** camelCase throughout (Prisma returns camelCase; no snake_case in API responses).

### Process Patterns

**Error Handling (API):**
```typescript
// All thrown errors must be AppError — never new Error() or raw res.json() in routes
class AppError extends Error {
  constructor(public code: string, public message: string,
              public statusCode: number, public details?: unknown) { super(message) }
}
// Express 5: async errors propagate automatically — no try/catch in route handlers
```

**Middleware composition order (always this sequence):**
```typescript
router.post('/employees', authenticate, requireRole('HR_ADMIN'), validate(createEmployeeSchema), handler)
```

**Audit capture rule:**
- ALL mutations go through a service method — never directly from route handlers
- Service methods call `AuditService.record(actor, action, entity, id, changes)` before returning
- Route handlers NEVER write to the audit table directly
- Route handlers NEVER call Prisma directly — always via service methods

**Prisma client:** Single shared instance exported from `lib/prisma.ts`. Never `new PrismaClient()` elsewhere.

**Frontend loading states:** Use TanStack Query `isLoading`/`isFetching`/`isError` — never custom boolean state. Show `<Skeleton>` on initial load, spinner on background refetch.

**Validation:** Zod schemas from `packages/types` are the single source of truth. Never duplicate validation inline in route files or component files.

### Enforcement Guidelines

**All AI Agents MUST:**
- Import Prisma client from `lib/prisma.ts` (never instantiate directly)
- Call `AuditService.record()` in every service method that mutates data
- Use `AppError` for all thrown errors
- Use Zod schemas from `packages/types` — never define inline validation in route files
- Return the standard success/error envelope on every endpoint
- Name test files `[source-file].test.ts` co-located with the source file

**Anti-patterns (never do these):**
- `new PrismaClient()` outside `lib/prisma.ts`
- `res.status(400).json({ message: '...' })` directly in route handlers
- `try/catch` in route handlers (Express 5 propagates async errors natively)
- `parseFloat()` or `Number()` on salary amounts (use `Decimal.js`)
- Dates as Unix timestamps in API responses (use ISO strings)
- Defining Zod schemas inside feature files when a shared schema exists in `packages/types`

## Project Structure & Boundaries

### Requirements-to-Structure Mapping

| FR Group | API Feature | Web Pages | Package Schemas |
|----------|-------------|-----------|-----------------|
| Auth & RBAC (FR-1–4) | `features/auth/`, `features/users/` | `(auth)/login/` | `auth.schema.ts` |
| Employee Management (FR-5–8) | `features/employees/` | `employees/` | `employee.schema.ts` |
| Salary Records (FR-9–11) | `features/salary-records/` | `employees/[id]/` | `salary.schema.ts` |
| Analytics Dashboard (FR-12–16) | `features/analytics/` | `analytics/` | `analytics.schema.ts` |
| Audit Log (FR-17–19) | `features/audit-log/`, `jobs/` | `audit-log/` | `audit.schema.ts` |
| System Settings (FR-20) | `features/system-settings/` | `settings/` | `settings.schema.ts` |

### Complete Project Directory Structure

```
acme-salary-mgmt/
├── .github/
│   └── workflows/
│       └── ci.yml                        ← lint + test + build on PR
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma             ← Models: User, Employee, SalaryRecord,
│   │   │   │                               AuditLog, FilterPreset, SystemSetting
│   │   │   ├── migrations/               ← Prisma Migrate generated files
│   │   │   └── seed.ts                   ← 10,000 employees via @faker-js/faker
│   │   └── src/
│   │       ├── index.ts                  ← Server entry: binds port, starts node-cron
│   │       ├── app.ts                    ← Express app factory (routes, middleware)
│   │       ├── env.ts                    ← @t3-oss/env-core startup validation
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   │   ├── auth.routes.ts    ← POST /api/v1/auth/login, /refresh, /logout
│   │       │   │   ├── auth.service.ts   ← login, refreshToken, revokeToken
│   │       │   │   └── auth.service.test.ts
│   │       │   ├── users/
│   │       │   │   ├── user.routes.ts    ← CRUD /api/v1/users (System Admin only)
│   │       │   │   ├── user.service.ts   ← createUser, deactivateUser, assignRole
│   │       │   │   └── user.service.test.ts
│   │       │   ├── employees/
│   │       │   │   ├── employee.routes.ts ← CRUD /api/v1/employees
│   │       │   │   ├── employee.service.ts ← create, list, update, deactivate
│   │       │   │   └── employee.service.test.ts
│   │       │   ├── salary-records/
│   │       │   │   ├── salary.routes.ts  ← POST/GET /api/v1/employees/:id/salary-history
│   │       │   │   ├── salary.service.ts ← setSalary, getHistory, checkAlertThreshold
│   │       │   │   └── salary.service.test.ts
│   │       │   ├── analytics/
│   │       │   │   ├── analytics.routes.ts ← GET /api/v1/analytics/overview, /distribution
│   │       │   │   ├── analytics.service.ts ← headcount, salaryDistribution, exportCsv
│   │       │   │   └── analytics.service.test.ts
│   │       │   ├── audit-log/
│   │       │   │   ├── audit.routes.ts   ← GET /api/v1/audit-log
│   │       │   │   └── audit.routes.test.ts
│   │       │   ├── system-settings/
│   │       │   │   ├── settings.routes.ts ← GET/PUT /api/v1/settings
│   │       │   │   ├── settings.service.ts ← getAll, update (+ invalidates cache)
│   │       │   │   └── settings.service.test.ts
│   │       │   └── filter-presets/
│   │       │       ├── preset.routes.ts  ← CRUD /api/v1/filter-presets (per user)
│   │       │       ├── preset.service.ts
│   │       │       └── preset.service.test.ts
│   │       ├── lib/
│   │       │   ├── prisma.ts             ← Single PrismaClient singleton
│   │       │   ├── audit.ts              ← AuditService.record() — called by all services
│   │       │   ├── settings-cache.ts     ← Map<string, {value, expiresAt}> with TTL
│   │       │   ├── errors.ts             ← AppError class + Express error middleware
│   │       │   ├── jwt.ts                ← signToken, verifyToken, signRefreshToken
│   │       │   └── s3.ts                 ← AWS S3 client + uploadNdjson helper
│   │       ├── middleware/
│   │       │   ├── auth.middleware.ts    ← authenticate: verifies JWT, attaches req.user
│   │       │   ├── rbac.middleware.ts    ← requireRole(...roles): returns middleware fn
│   │       │   ├── validate.middleware.ts ← validate(schema): Zod parse body+query
│   │       │   └── rate-limit.middleware.ts ← loginRateLimiter (5 req/5min/IP)
│   │       ├── jobs/
│   │       │   ├── audit-archival.job.ts ← node-cron daily: query → S3 NDJSON → delete
│   │       │   └── audit-archival.job.test.ts
│   │       └── docs/
│   │           └── openapi.ts            ← zod-to-openapi registry → Swagger UI /api/docs
│   │
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx            ← Root layout, QueryClientProvider, auth guard
│           │   ├── page.tsx              ← Redirect → /dashboard
│           │   ├── (auth)/
│           │   │   └── login/page.tsx    ← Login form (no auth required)
│           │   ├── dashboard/page.tsx    ← Headcount stats, quick links (FR-12)
│           │   ├── employees/
│           │   │   ├── page.tsx          ← Employee list: search, filter, paginate (FR-6)
│           │   │   ├── new/page.tsx      ← Create employee form (FR-5)
│           │   │   └── [id]/page.tsx     ← Employee detail + salary history (FR-7,10)
│           │   ├── analytics/page.tsx    ← Distribution charts, presets, export (FR-13–16)
│           │   ├── audit-log/page.tsx    ← Audit log viewer (FR-18)
│           │   └── settings/page.tsx     ← System settings form (FR-20, admin only)
│           ├── components/
│           │   ├── ui/                   ← shadcn/ui (auto-generated — never edit manually)
│           │   ├── shared/
│           │   │   ├── AppShell.tsx      ← Sidebar nav + topbar layout wrapper
│           │   │   ├── DataTable.tsx     ← TanStack Table v8 reusable wrapper
│           │   │   ├── Pagination.tsx
│           │   │   ├── SearchInput.tsx   ← Debounced search input
│           │   │   └── ConfirmDialog.tsx ← Reusable confirmation modal
│           │   ├── employees/
│           │   │   ├── EmployeeTable.tsx
│           │   │   ├── EmployeeForm.tsx  ← RHF + Zod, handles create + edit
│           │   │   ├── EmployeeFilters.tsx
│           │   │   └── SalaryHistoryDrawer.tsx
│           │   ├── salary/
│           │   │   ├── SalaryForm.tsx
│           │   │   └── SalaryAlertDialog.tsx ← Shown when Δ > threshold (FR-11)
│           │   ├── analytics/
│           │   │   ├── SalaryDistributionChart.tsx ← Recharts
│           │   │   ├── HeadcountStats.tsx
│           │   │   ├── AnalyticsFilters.tsx
│           │   │   └── FilterPresetsSidebar.tsx   ← Save/recall presets (FR-15)
│           │   └── audit-log/
│           │       └── AuditLogTable.tsx
│           ├── hooks/
│           │   ├── useEmployees.ts
│           │   ├── useEmployee.ts
│           │   ├── useSalaryMutation.ts
│           │   ├── useAnalytics.ts
│           │   ├── useFilterPresets.ts
│           │   ├── useAuditLog.ts
│           │   └── useSystemSettings.ts
│           └── lib/
│               ├── api.ts               ← fetch wrapper: base URL, auth header, error parse
│               ├── query-client.ts      ← TanStack QueryClient singleton
│               └── env.ts               ← Frontend env validation (NEXT_PUBLIC_API_URL)
│
├── packages/
│   └── types/
│       └── src/
│           ├── schemas/
│           │   ├── employee.schema.ts
│           │   ├── salary.schema.ts
│           │   ├── auth.schema.ts
│           │   ├── audit.schema.ts
│           │   ├── analytics.schema.ts
│           │   ├── settings.schema.ts
│           │   ├── pagination.schema.ts
│           │   └── preset.schema.ts
│           └── index.ts                 ← Re-exports all schemas + z.infer<> types
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                         ← Root workspace scripts: dev, build, test, lint
└── .env.example
```

### Prisma Data Model

```prisma
model User {
  id            String        @id @default(cuid())
  email         String        @unique
  passwordHash  String
  role          Role          @default(HR_VIEWER)
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  auditLogs     AuditLog[]
  filterPresets FilterPreset[]
}

model Employee {
  id            String         @id @default(cuid())
  employeeCode  String         @unique
  firstName     String
  lastName      String
  email         String         @unique
  department    String
  jobTitle      String
  country       String
  status        EmployeeStatus @default(ACTIVE)
  startDate     DateTime
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  salaryRecords SalaryRecord[]

  @@index([lastName, firstName])
  @@index([department])
  @@index([country])
  @@index([status])
}

model SalaryRecord {
  id            String       @id @default(cuid())
  employeeId    String
  amount        Decimal      @db.Decimal(15, 4)
  currencyCode  String
  payFrequency  PayFrequency
  effectiveDate DateTime
  createdAt     DateTime     @default(now())
  createdBy     String
  employee      Employee     @relation(fields: [employeeId], references: [id])

  @@index([employeeId, effectiveDate(sort: Desc)])
}

model AuditLog {
  id         String      @id @default(cuid())
  actorId    String
  actorEmail String
  action     AuditAction
  entityType String
  entityId   String
  fieldName  String?
  oldValue   String?
  newValue   String?
  timestamp  DateTime    @default(now())
  actor      User        @relation(fields: [actorId], references: [id])

  @@index([timestamp])
  @@index([actorId])
  @@index([entityType, entityId])
}

model FilterPreset {
  id         String   @id @default(cuid())
  userId     String
  name       String
  filterJson String
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])

  @@unique([userId, name])
}

model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}

model RefreshToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}

enum Role           { SYSTEM_ADMIN HR_ADMIN HR_VIEWER }
enum EmployeeStatus { ACTIVE INACTIVE }
enum PayFrequency   { MONTHLY ANNUAL }
enum AuditAction    { CREATE UPDATE DEACTIVATE ARCHIVE }
```

### Architectural Boundaries

**Full API Endpoint List:**
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/users                         (SYSTEM_ADMIN)
POST   /api/v1/users                         (SYSTEM_ADMIN)
PATCH  /api/v1/users/:id                     (SYSTEM_ADMIN)

GET    /api/v1/employees                     (all roles)
POST   /api/v1/employees                     (HR_ADMIN)
GET    /api/v1/employees/:id                 (all roles)
PATCH  /api/v1/employees/:id                 (HR_ADMIN)
DELETE /api/v1/employees/:id                 (HR_ADMIN — soft delete)

GET    /api/v1/employees/:id/salary-history  (all roles)
POST   /api/v1/employees/:id/salary-history  (HR_ADMIN)

GET    /api/v1/analytics/overview            (all roles)
GET    /api/v1/analytics/distribution        (all roles)
GET    /api/v1/analytics/export              (all roles — streams CSV)

GET    /api/v1/audit-log                     (HR_ADMIN, SYSTEM_ADMIN)

GET    /api/v1/settings                      (SYSTEM_ADMIN)
PUT    /api/v1/settings                      (SYSTEM_ADMIN)

GET    /api/v1/filter-presets                (own presets, all roles)
POST   /api/v1/filter-presets                (all roles)
PUT    /api/v1/filter-presets/:id            (own preset only)
DELETE /api/v1/filter-presets/:id            (own preset only)

GET    /api/docs                             (Swagger UI)
```

**Data Flow:**
```
Browser → Next.js → lib/api.ts fetch wrapper
  → Express route → validate → authenticate → requireRole
  → Feature service → AuditService.record() → Prisma → SQLite/PostgreSQL

node-cron (daily) → AuditArchivalJob
  → Prisma (query expired entries) → lib/s3.ts (NDJSON upload) → Prisma (delete rows)
```

**External Integration Points:**
- `packages/types`: shared by `apps/api` (validation) and `apps/web` (form + types)
- AWS S3: write-only via `lib/s3.ts`; credentials via env vars only
- Vercel ↔ Railway: CORS restricted to `NEXT_PUBLIC_WEB_URL`

### Development Workflow

```bash
pnpm dev                          # all apps in parallel
pnpm --filter api test            # vitest run
pnpm --filter api test:cov        # vitest --coverage
pnpm --filter api db:migrate      # prisma migrate dev
pnpm --filter api db:seed         # prisma db seed (10,000 employees)
pnpm --filter api db:studio       # prisma studio
pnpm build                        # turborepo ordered build
```

## Architecture Validation Results

### Coherence Validation ✅

All technology choices are mutually compatible and all patterns align with the stack. Project structure maps 1:1 to FR groups. No contradictory decisions found.

### Requirements Coverage ✅

All 20 FRs architecturally supported. All NFRs addressed (indexes for performance, SQL aggregation, rate limiting, audit immutability, co-located tests with coverage).

### Gap Analysis

**Critical Gaps:** None

**Important Gap Resolved — Refresh Token Revocation:**
Added `RefreshToken` model to Prisma schema (see Data Model above). `auth.service.ts` stores a bcrypt hash of the token on login, deletes the row on logout, and verifies hash existence + expiry on refresh. Expired tokens are pruned during login/refresh operations — no separate cleanup job needed.

**Nice-to-Have (post-MVP):** E2E tests (Playwright), Dockerfile for local dev parity, `.env.example` content spec.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Medium; 10,000 employees, single-tenant)
- [x] Technical constraints identified (TypeScript, Prisma, SQLite→PostgreSQL, S3)
- [x] Cross-cutting concerns mapped (9 identified and addressed)

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified (all versions verified via web search)
- [x] Integration patterns defined (S3, CORS, shared types package)
- [x] Performance considerations addressed (DB indexes, SQL-level aggregation)

**Implementation Patterns**
- [x] Naming conventions established (DB, API, TypeScript, files)
- [x] Structure patterns defined (feature-based, co-located tests)
- [x] Communication patterns specified (error envelope, ISO dates, pagination)
- [x] Process patterns documented (AppError, audit rule, Prisma singleton)

**Project Structure**
- [x] Complete directory structure defined (all files named)
- [x] Component boundaries established (route → service → audit → prisma)
- [x] Integration points mapped (packages/types, S3, CORS)
- [x] Requirements to structure mapping complete (all 20 FRs mapped)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** High

**Key Strengths:**
- Zod schemas shared via `packages/types` eliminate type drift between API and frontend
- `AuditService` as a cross-cutting lib enforces audit capture consistency across all features
- Prisma `Decimal` type prevents monetary precision bugs at the schema level
- Feature-based directory structure scales cleanly as stories are added incrementally
- Express 5 native async error propagation simplifies route handlers significantly
- `RefreshToken` model enables proper logout/revocation without external state store

**Areas for Future Enhancement:**
- Redis for distributed rate limiting (current in-memory store is single-server only)
- Separate worker process for audit archival job (node-cron in-process is fine for assessment)
- E2E test suite with Playwright
- Employee email change with email verification flow (deferred to v2 per PRD)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns (§Implementation Patterns & Consistency Rules) on every file
- Respect project structure boundaries (route handlers never call Prisma directly)
- This document is the single source of architectural truth — refer to it for every decision

**First Implementation Story:**
```bash
npx create-turbo@latest acme-salary-mgmt -m pnpm
```
**Implementation sequence:** monorepo scaffold → Prisma schema + migrations → shared types package → auth middleware → RBAC → employee CRUD + audit → salary records → analytics → system settings → audit archival job → Next.js frontend → seed script → deploy.
