---
title: ACME Salary Management System
status: final
created: 2026-06-20
updated: 2026-06-20
---

# PRD: ACME Salary Management System

## 0. Document Purpose

This PRD defines requirements for ACME org's web-based salary management system, targeting the HR Manager persona. It is structured for downstream consumption by architecture, UX, and engineering workflows. Tech stack decisions (Node.js/Express/TypeScript backend, Prisma ORM, SQLite→PostgreSQL, Next.js, shadcn/ui) are recorded in the addendum and referenced here only where they constrain requirements.

---

## 1. Vision

ACME's HR team manages salary data for 10,000 employees across multiple countries today via Excel spreadsheets — a process that is error-prone, unaudited, difficult to search, and impossible to analyze at scale. A single mis-keyed cell can propagate a compensation error affecting payroll; there is no change history, no access control, and no way to answer strategic questions like "what is our median engineering salary in Germany?"

This system replaces that workflow with a secure, audited, web-based platform that gives HR Managers a single source of truth for employee compensation data. It supports full CRUD on employee and salary records, enforces role-based access, logs every change with attribution, and surfaces analytical insights through a dashboard — enabling ACME to move from reactive spreadsheet management to proactive compensation governance.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Manage records:** Add, update, search, and deactivate employee salary records without fear of accidental overwrite or data loss
- **Audit changes:** Know who changed what salary, when, and from what value — for compliance and dispute resolution
- **Answer org questions:** Quickly surface salary distributions by department, country, and role to inform compensation reviews
- **Control access:** Ensure only authorized HR staff can view or modify sensitive compensation data
- **Replace Excel:** Eliminate manual file management, versioning chaos, and emailed spreadsheets

### 2.2 Non-Users (v1)

- **Individual employees** — no self-service portal; employees cannot view their own salary records
- **Finance / Payroll systems** — no integrations; this system stores data only, does not trigger payments
- **Executives / Managers** — no delegation or approval workflows in v1

### 2.3 Key User Journeys

**UJ-1. Sarah updates a salary after a promotion.**
Sarah, Senior HR Manager, has just processed a promotion. She logs in (email + password, JWT session). She searches by employee name, opens the record, edits the base salary and effective date, and saves. The system saves the change, records the previous value in the audit log with Sarah's identity and timestamp, and shows a success confirmation. Sarah sees the updated record immediately. *Edge case:* if Sarah enters a salary outside a configurable alert threshold (e.g., >50% increase), the system warns but does not block.

**UJ-2. Sarah answers a leadership question about compensation.**
Leadership asks: "What is our average software engineer salary across EU countries?" Sarah navigates to the Analytics dashboard, filters by job title and country (multiple select), and sees median, mean, min, max, and headcount. She exports the filtered dataset as CSV to share with the CFO.

**UJ-3. A new HR Viewer is onboarded.**
A System Admin creates a new user account for a junior HR analyst, assigns the HR Viewer role (read-only). The analyst can search and view employee salary records but cannot edit, create, or delete. All access attempts are reflected in the audit log.

---

## 3. Glossary

- **Employee** — a person employed by ACME org, identified by a unique Employee ID, with associated personal and employment attributes.
- **Salary Record** — the compensation entry for an Employee at a given point in time: base salary amount, currency code, effective date, and pay frequency.
- **Salary History** — the ordered set of all Salary Records for an Employee, preserving past values when a new record supersedes them.
- **Department** — an organizational unit employees belong to (e.g., Engineering, Sales).
- **Country** — the country of employment for an Employee, used for grouping and filtering; does not imply tax or legal jurisdiction handling.
- **Currency Code** — ISO 4217 three-letter code (e.g., USD, EUR, INR) stored with each Salary Record.
- **Role** — an authorization level assigned to a platform User: `HR Admin`, `HR Viewer`, or `System Admin`.
- **User** — a human with a platform login, distinct from an Employee (a User may manage Employee records without being one).
- **Audit Log** — an immutable, append-only record of every create/update/delete on Employee and Salary Records, capturing actor identity, timestamp, field changed, old value, and new value.
- **Audit Archive** — a set of Audit Log entries that have exceeded the configured retention period, exported to S3 in NDJSON format before deletion from the primary database.
- **Effective Date** — the date from which a Salary Record is active; used to reconstruct historical compensation at any point in time.
- **Filter Preset** — a named, saved combination of Analytics Dashboard dimension filters (department, country, job title, active/inactive toggle) that an authenticated User can recall in a single click.
- **System Setting** — a configurable platform-wide parameter managed by a System Admin, stored in the database and readable by the application at runtime (e.g., salary alert threshold, audit retention period).

---

## 4. Features

### 4.1 Authentication & Authorization

**Description:** All platform access requires authentication. Users log in with email and password; sessions are managed via signed JWTs with refresh tokens. Three roles exist: `HR Admin` (full read/write on all records + user management within HR Viewer role), `System Admin` (user account management, role assignment), and `HR Viewer` (read-only across all records). Role checks are enforced server-side on every API endpoint. Passwords are hashed with bcrypt; tokens expire and are rotatable.

**Functional Requirements:**

#### FR-1: User Login
An unauthenticated User can authenticate with a valid email + password pair. On success, the system issues a signed JWT access token (15-min TTL) and a refresh token (7-day TTL, stored httpOnly cookie). On failure, the system returns a generic error (no field-level hints) and rate-limits after 5 consecutive failures per IP.

**Consequences (testable):**
- Valid credentials → 200 + access token in response body
- Invalid credentials → 401, no token issued
- 6th consecutive failure within 5 minutes → 429 Too Many Requests

#### FR-2: Token Refresh
An authenticated User with a valid refresh token can obtain a new access token without re-entering credentials. Expired or tampered refresh tokens are rejected.

#### FR-3: Role-Based Access Enforcement
Every API route checks the requesting User's Role before execution. HR Viewer requests to mutating endpoints (POST/PUT/PATCH/DELETE on employees or salaries) return 403.

**Consequences (testable):**
- HR Viewer GET /employees → 200
- HR Viewer POST /employees → 403
- HR Admin POST /employees → 201
- Unauthenticated request to any protected route → 401

#### FR-4: User Management (System Admin)
A System Admin can create, deactivate, and assign roles to platform Users. System Admins cannot assign the System Admin role via the UI (must be a direct DB operation for safety). [ASSUMPTION: a seed System Admin account is created by the seed script]

---

### 4.2 Employee Record Management

**Description:** HR Admins can create, view, update, and soft-delete employee records. Each employee has a profile (personal + employment fields) and an associated Salary History. Employees are never hard-deleted — they are deactivated to preserve audit integrity. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-5: Create Employee
An HR Admin can create an Employee record with required fields: first name, last name, email, employee ID (auto-generated or manual), department, job title, country, employment start date. On success, a Salary Record may optionally be created in the same flow.

**Consequences (testable):**
- Missing required field → 422 with field-level validation error
- Duplicate employee ID or email → 409 Conflict
- Successful create → 201 + full employee object

#### FR-6: View & Search Employees
Any authenticated User can list employees with pagination (default 50/page) and filter by: name (partial match), department, country, job title, employment status (active/inactive). Results are sorted by name ascending by default; sort column and direction are configurable.

**Consequences (testable):**
- Search by partial name returns all employees whose name contains the string (case-insensitive)
- Filter by department=Engineering returns only Engineering employees
- Pagination: page=2&limit=50 returns the correct offset slice

#### FR-7: Update Employee
An HR Admin can update any Employee field except employee ID and email (immutable after creation). [ASSUMPTION: email changes require a separate verified flow, deferred to v2]

#### FR-8: Deactivate Employee
An HR Admin can deactivate an Employee (soft-delete). Deactivated employees remain searchable with `status=inactive` filter. Their Salary History is preserved and readable.

---

### 4.3 Salary Record Management

**Description:** Salary data is versioned. When a salary is updated, the previous Salary Record is preserved in Salary History; a new record with the new effective date becomes the current salary. HR Admins can view full Salary History for any employee. Realizes UJ-1.

**Functional Requirements:**

#### FR-9: Set / Update Salary
An HR Admin can set or update an Employee's current salary: base amount (decimal), currency code (ISO 4217), pay frequency (Monthly/Annual), and effective date. Saving creates a new Salary Record; the previous record is retained in Salary History.

**Consequences (testable):**
- Salary update → new Salary Record created, previous record preserved with original values
- Salary amount ≤ 0 → 422 validation error
- Invalid currency code → 422 validation error

#### FR-10: View Salary History
Any authenticated User can view the full Salary History for an Employee in reverse chronological order (most recent first), showing amount, currency, effective date, and the User who made the change.

#### FR-11: Salary Change Alert
When a salary update exceeds the configured alert threshold percentage (System Setting `salary_alert_threshold_pct`, default 50%) of the previous base salary in the same currency, the UI displays a warning confirmation dialog before saving. The change is not blocked.

---

### 4.4 Analytics Dashboard

**Description:** Provides the HR Manager with aggregate views to answer compensation questions. All analytics operate on active employees only by default; inactive employees can be included via an "Include Inactive" toggle. Saved Filter Presets allow users to recall frequently-used filter combinations. Realizes UJ-2.

**Functional Requirements:**

#### FR-12: Compensation Overview
The dashboard displays organization-wide metrics: total headcount (active), headcount by country, headcount by department.

#### FR-13: Inactive Employee Toggle
The dashboard displays active employees only by default. Any authenticated User can toggle "Include Inactive Employees" to include deactivated employees in all dashboard metrics and distribution views.

**Consequences (testable):**
- Default view excludes employees with `status=inactive`
- Toggle enabled → deactivated employees appear in all aggregations with visual indicator distinguishing their count

#### FR-14: Salary Distribution by Dimension
Any authenticated User can filter salary data by one or more dimensions (department, country, job title) and view: median, mean, min, max salary, and headcount for the filtered cohort. All values displayed in their stored currency; no cross-currency aggregation. [ASSUMPTION: multi-currency aggregation is explicitly out of scope; users filter to a single-currency cohort for meaningful comparisons]

#### FR-15: Filter Presets
Any authenticated User can save the current set of active Analytics Dashboard filters (dimensions + inactive toggle state) as a named Filter Preset. Saved presets are per-user, listed in a sidebar or dropdown, and can be renamed or deleted. Applying a preset restores all filter state in one click.

**Consequences (testable):**
- Save preset with name "EU Engineers" → preset appears in the user's preset list
- Applying preset sets all filters to the saved state exactly
- Deleting a preset removes it from the list; does not affect other users' presets

#### FR-16: Data Export
Any authenticated User can export the current filtered employee + salary view as a CSV file. Export reflects active filters and the inactive toggle state.

---

### 4.5 Audit Log

**Description:** Every create, update, and deactivation of Employee and Salary Records is captured in an immutable Audit Log with full attribution. The log is viewable by HR Admins and System Admins; HR Viewers do not have access. Entries older than the configured retention period are archived to S3 in NDJSON format before being removed from the primary database. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-17: Automatic Audit Capture
The system automatically records an audit entry on every mutating operation: actor (User ID + email), action type (CREATE/UPDATE/DEACTIVATE), target entity (Employee or Salary Record + ID), timestamp (UTC), and for UPDATE: field name, old value, new value.

**Consequences (testable):**
- Salary update → audit entry created with correct old/new values and actor identity
- Audit entries cannot be modified or deleted via any API endpoint
- Unauthenticated or HR Viewer requests to the audit log API → 403

#### FR-18: Audit Log View
HR Admins and System Admins can view the audit log filtered by date range, actor (User ID or email), and entity type (Employee or Salary Record). Results paginated (50/page), sorted by timestamp descending.

#### FR-19: Audit Log Retention & Archival
The system enforces a configurable retention period (System Setting `audit_retention_days`, default 365). A scheduled background job (runs daily) identifies entries older than the retention period, writes them to a configured S3 bucket as NDJSON (one JSON object per line, one file per batch with a date-stamped key prefix), confirms the upload, then deletes the source rows from the database.

**Consequences (testable):**
- Entries older than `audit_retention_days` are not deleted until successfully written to S3
- If the S3 upload fails, the job logs the failure, retains the rows, and retries on the next scheduled run
- Each archived NDJSON file contains valid, parseable JSON lines matching the audit entry schema
- A completed archival run produces an audit meta-entry recording: timestamp, count archived, S3 key prefix, and success/failure status

---

### 4.6 System Settings

**Description:** A System Admin can manage platform-wide configuration parameters through a settings UI. Settings are persisted in the database and applied at runtime without requiring a redeploy. All setting changes are captured in the Audit Log.

**Functional Requirements:**

#### FR-20: View & Edit System Settings
A System Admin can view and update the following System Settings:
- `salary_alert_threshold_pct` (integer, 1–200, default 50) — percentage change above which the salary alert dialog is shown
- `audit_retention_days` (integer, 30–3650, default 365) — number of days audit entries are retained before archival
- `s3_archive_bucket` (string) — the S3 bucket name for audit log archival
- `s3_archive_prefix` (string, default `audit-archive/`) — key prefix used when writing NDJSON archive files

**Consequences (testable):**
- Changing `salary_alert_threshold_pct` to 25 → salary updates ≥25% trigger the alert dialog
- Changing `audit_retention_days` to 180 → next archival job uses the new value
- Settings changes are recorded in the Audit Log with old and new values

---

## 5. Non-Goals (Explicit)

- **Payroll processing** — this system stores and manages salary *data*; it does not execute payments, calculate tax, or integrate with banking systems
- **Tax / jurisdiction compliance** — no jurisdiction-specific salary rules, tax withholding calculations, or legal compliance reporting
- **Employee self-service** — employees cannot log in to view their own compensation
- **SSO / SAML / OAuth federation** — JWT email+password auth is sufficient for this scope; enterprise SSO is a v2 concern
- **Live FX currency conversion** — salaries are stored and displayed in their recorded currency; no real-time exchange rate conversion
- **Performance reviews / compensation bands** — no salary banding, grade management, or performance-linked compensation workflows
- **Integrations** — no HRIS (Workday, SAP, BambooHR) integrations; no payroll provider APIs
- **Mobile native app** — responsive web only
- **Approval workflows** — no multi-step approval for salary changes in v1
- **Document management** — no offer letters, contracts, or attachment storage

---

## 6. MVP Scope

### 6.1 In Scope

- JWT-based authentication with refresh tokens
- Three-role RBAC (System Admin, HR Admin, HR Viewer)
- Employee CRUD with soft-delete and search/filter/pagination
- Versioned salary records with full history
- Salary change alert with configurable threshold (System Setting)
- Analytics dashboard: headcount + salary distribution by department/country/job title
- Inactive employee toggle on analytics (excluded by default)
- Saved Filter Presets per user
- CSV export of filtered data
- Immutable audit log with attribution (HR Admin + System Admin access)
- Configurable audit log retention (default 1 year) with S3 archival in NDJSON
- System Settings management (System Admin only)
- Seed script: 10,000 realistic employees across departments and countries
- Unit tests covering core domain logic (auth, salary versioning, RBAC enforcement, analytics aggregation, archival job)
- Deployed and accessible via public URL

### 6.2 Out of Scope for MVP

- Payroll processing or payment execution *(requires banking/tax compliance — separate product domain)*
- Employee self-service portal *(adds auth surface; not the HR Manager persona's need)*
- SSO / SAML *(v2; JWT sufficient for assessment scope)*
- Live currency conversion *(v2; requires FX API + rate management)*
- Approval workflows for salary changes *(v2; adds significant state machine complexity)*
- Mobile native app *(v2)*
- HRIS / payroll integrations *(v2)*
- Compensation bands / grade management *(v2)*

---

## 7. Success Metrics

**Primary**
- **SM-1:** HR Manager can locate any employee and view their current salary in under 5 seconds from a 10,000-row dataset. Validates FR-6.
- **SM-2:** Every salary update is captured in the Audit Log with correct old/new values, actor, and timestamp — 100% of mutations. Validates FR-15.

**Secondary**
- **SM-3:** Analytics dashboard renders filtered salary distribution in under 3 seconds for any department/country combination. Validates FR-14.
- **SM-4:** Unit tests cover ≥80% of backend domain logic (auth, salary versioning, RBAC, analytics, archival job). Validates overall code quality.
- **SM-5:** Audit archival job completes without data loss — every archived NDJSON file is readable and row counts reconcile with deleted DB entries. Validates FR-19.

**Counter-metrics (do not optimize)**
- **SM-C1:** Do not optimize for minimal click count at the expense of confirmation steps — the salary change alert (FR-11) and deactivation confirmation must not be skipped to improve UX speed metrics.

---

## 8. Open Questions

*All four original open questions have been resolved:*

1. ~~Salary alert threshold~~ → **Resolved:** Configurable via System Setting `salary_alert_threshold_pct` (default 50%). See FR-11, FR-20.
2. ~~Analytics filter presets~~ → **Resolved:** In scope. See FR-15.
3. ~~Audit log retention~~ → **Resolved:** Configurable via `audit_retention_days` (default 365 days); expired entries archived to S3 as NDJSON before deletion. See FR-19, FR-20.
4. ~~Deactivated employees in analytics~~ → **Resolved:** Excluded by default; "Include Inactive" toggle restores them. See FR-13.

*No open questions remain. All assumptions resolved are removed from §9.*

---

## 9. Assumptions Index

- **§4.1/FR-4:** A seed System Admin account is created by the database seed script with known credentials, rotated before any real deployment.
- **§4.4/FR-14:** Multi-currency salary aggregation (e.g., average across USD + EUR employees) is explicitly out of scope; users are expected to filter to a single-currency cohort for meaningful comparisons.
- **§4.2/FR-7:** Email is immutable after employee creation; a verified-change flow is deferred to v2.
- **§4.6/FR-20:** S3 credentials (`s3_archive_bucket`, AWS keys) are supplied via environment variables; the System Settings UI configures bucket name and prefix only, not credentials.
