# Deferred Work

Goals deferred from the initial quick-dev split. Tackle in order — each depends on the one above.

## Goal 2: Auth
JWT login/refresh/logout endpoints, bcrypt, RBAC middleware (`requireRole`), user management endpoints (System Admin). Depends on: Goal 1 (Foundation).

## Goal 3: Employee Management
Employee CRUD (create, list/search/filter/paginate, update, soft-deactivate). Audit capture on all mutations. Depends on: Goals 1–2.

## Goal 4: Salary Records
Versioned salary history (append-only), alert threshold check against `SystemSetting`, `SalaryAlertDialog` stub for frontend. Depends on: Goals 1–3.

## Goal 5: Analytics
Headcount overview, salary distribution by dimension (SQL aggregation), inactive-employee toggle, filter presets (CRUD), CSV export stream. Depends on: Goals 1–3.

## Goal 6: Audit Log + System Settings
Audit log viewer endpoint (paginated, filterable), system settings GET/PUT, daily archival job (node-cron → S3 NDJSON → safe delete), settings cache with TTL. Depends on: Goals 1–3.

## Goal 7: Next.js Frontend
Full Next.js 16 App Router frontend: login, dashboard, employee list/detail, salary history drawer, salary alert dialog, analytics dashboard with charts and filter presets, audit log viewer, system settings page. TanStack Query hooks, shadcn/ui, Recharts. Depends on: Goals 1–6.

## Goal 8: Seed Script + Deployment
10,000-employee seed via `@faker-js/faker` (realistic names, departments, countries, salaries), `prisma db seed` hook. Railway (API + PostgreSQL) + Vercel (web) deployment. CI via GitHub Actions (lint + test + build on PR). Depends on: Goals 1–7.
