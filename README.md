# ACME Salary Management

Full-stack employee salary management system built for the Incubyte engineering assessment. Manages salary data for 10,000+ employees across multiple countries, replacing spreadsheet-based workflows with a role-based web application.

## Architecture

```
acme-salary-mgmt/          ← Turborepo monorepo (pnpm)
├── apps/
│   ├── api/               ← Express 5 + TypeScript REST API
│   └── web/               ← Next.js 16 frontend
└── packages/
    └── types/             ← Shared Zod schemas and TypeScript types
```

**Stack:** Node.js 22 · Express 5 · Prisma 5 · SQLite · Next.js 16 · shadcn/ui · TanStack Query · Recharts

## Features

- **Auth** — JWT access tokens (15 min) + httpOnly refresh token cookies (7 days), hashed with SHA-256 in DB
- **RBAC** — Three roles: `SYSTEM_ADMIN`, `HR_ADMIN`, `HR_VIEWER`, enforced on every endpoint
- **Employee management** — Paginated list with search/filter, create/edit, soft-delete
- **Salary records** — Versioned history per employee; configurable alert threshold blocks large unexplained changes
- **Analytics** — Salary distribution (mean/median/min/max), department breakdown, CSV export
- **Audit log** — Immutable trail of every mutation; daily S3 archival cron with safe-delete (upload confirmed before DB deletion)
- **System settings** — Runtime-configurable alert threshold and retention period (cached in-process with 60s TTL)
- **Seed** — 10,000 employees across 15 departments and 15 countries, with realistic salary ranges

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+

### Install

```bash
pnpm install
```

### Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-minimum-32-characters-long"
PORT=3001
NODE_ENV=development
# Optional — S3 archival (leave blank to disable)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Database setup and seed

```bash
cd apps/api
pnpm db:migrate    # run migrations
pnpm db:seed       # seed 10,000 employees (~2–3 min)
```

### Run in development

```bash
pnpm dev           # starts API on :3001 and web on :3000
```

## Default Credentials

| Email | Password | Role |
|---|---|---|
| admin@acme.com | Admin@12345 | SYSTEM_ADMIN |
| hradmin@acme.com | HrAdmin@12345 | HR_ADMIN |
| viewer@acme.com | Viewer@12345 | HR_VIEWER |

## API Reference

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login, sets refresh cookie |
| POST | `/api/auth/refresh` | Public | Rotate access token |
| POST | `/api/auth/logout` | Public | Clear refresh cookie |
| GET | `/api/employees` | Any | List with pagination + filters |
| POST | `/api/employees` | HR_ADMIN+ | Create employee |
| PATCH | `/api/employees/:id` | HR_ADMIN+ | Update employee |
| DELETE | `/api/employees/:id` | HR_ADMIN+ | Soft-delete |
| GET | `/api/employees/:id/salaries` | Any | Salary history |
| POST | `/api/employees/:id/salaries` | HR_ADMIN+ | Add salary record |
| GET | `/api/analytics/overview` | Any | Headcount + salary summary |
| GET | `/api/analytics/distribution` | Any | Salary distribution stats |
| GET | `/api/analytics/departments` | Any | Per-department breakdown |
| GET | `/api/analytics/export/csv` | Any | Download salary CSV |
| GET | `/api/audit-logs` | HR_ADMIN+ | Paginated audit trail |
| GET | `/api/settings` | SYSTEM_ADMIN | All system settings |
| PUT | `/api/settings/:key` | SYSTEM_ADMIN | Update a setting |
| GET | `/api/users` | SYSTEM_ADMIN | List users |
| POST | `/api/users` | SYSTEM_ADMIN | Create user |
| PATCH | `/api/users/:id/active` | SYSTEM_ADMIN | Activate / deactivate user |

## Testing

```bash
pnpm test              # run all tests
pnpm --filter @acme/api test:cov   # API coverage report
```

Tests run against an isolated `test.db`; migrations are applied automatically via `globalSetup`.

## Project Structure

```
apps/api/src/
├── features/
│   ├── auth/          # login · refresh · logout
│   ├── users/         # user management (SYSTEM_ADMIN)
│   ├── employees/     # CRUD + soft-delete
│   ├── salaries/      # versioned salary records
│   ├── analytics/     # stats + CSV export
│   ├── audit/         # audit log view
│   └── settings/      # system settings
├── jobs/
│   └── auditArchiver  # daily S3 archival cron
└── lib/
    ├── middleware/     # auth · requireRole · errorHandler
    ├── jwt.ts          # sign · verify · hash
    ├── audit.ts        # recordAudit helper
    └── settings.ts     # cached settings

apps/web/src/
├── app/
│   ├── (auth)/login   # login page
│   └── (protected)/   # dashboard · employees · analytics · audit · settings
└── lib/
    ├── api.ts          # axios instance with auto-refresh
    └── auth.tsx        # AuthProvider + useAuth
```

## Planning Artifacts

Design documents committed in `_bmad-output/`:

- `planning-artifacts/prds/` — One-page PRD (scope, features, deliberate exclusions)
- Architecture and design notes

## Security Notes

- Passwords hashed with bcrypt (cost 12)
- Refresh tokens stored as SHA-256 hash; plain token never persisted
- Auth errors return generic messages (no field-level hints)
- CORS restricted to `WEB_URL` origin
- SYSTEM_ADMIN role can only be assigned via direct DB operation, never through the UI
- AWS credentials via environment variables only
