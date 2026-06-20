# PRD Addendum — ACME Salary Management System

*Depth that belongs in downstream architecture/design docs but was produced during PRD discovery.*

---

## Tech Stack (Architecture doc will formalize these)

- **Backend:** Node.js + Express, TypeScript
- **ORM:** Prisma (chosen over Drizzle for: stronger TypeScript codegen, mature SQLite + PostgreSQL adapter support, migration tooling)
- **Database:** SQLite (development/assessment), PostgreSQL (production path)
- **Frontend:** Next.js (App Router), shadcn/ui component library
- **Auth mechanism:** JWT (access token 15-min, refresh token 7-day httpOnly cookie), bcrypt password hashing

## Auth Design Notes

- Refresh token rotation on use (old token invalidated, new one issued)
- JWT payload: `{ sub: userId, email, role, iat, exp }`
- Rate limiting on `/auth/login`: 5 attempts / 5 min / IP
- No SAML/SSO in v1; password reset flow is in scope but not detailed in PRD (assume email-based)

## Currency Strategy

Salaries stored as `{ amount: Decimal, currency_code: ISO4217, pay_frequency: enum }`. No conversion. Analytics filters are expected to be used on single-currency cohorts. The PRD explicitly calls this out as an assumption (§9) to ensure downstream architecture doesn't silently add FX logic.

## Seed Script Design Notes

- 10,000 employees across ~10 departments, ~15 countries, ~20 job titles
- Realistic name/email generation (faker.js or similar)
- Salary ranges seeded per country (rough PPP approximation for realism)
- 1 System Admin seed account with documented credentials

## Audit Archival Design Notes

- **NDJSON format chosen** — line-oriented JSON; each line is one audit entry as a complete JSON object. Compatible with `jq`, Athena, BigQuery, and most log tooling without a schema declaration. Easier to stream and parse than JSON arrays for large volumes.
- **S3 key pattern (recommended for architecture):** `{prefix}{YYYY}/{MM}/{DD}/audit-{timestamp}-{uuid}.ndjson` — partitioned by date for cost-efficient Athena queries if needed later.
- **Safe-delete pattern (required):** Upload to S3 → verify HTTP 200 + ETag → delete from DB. If upload fails, rows are retained and retried next run. A meta audit entry records each archival job outcome.
- **Credentials:** AWS credentials (access key / secret or IAM role) supplied via environment variables, never stored in the DB or System Settings UI.
- **Scheduled job mechanism:** Architecture doc will decide (cron via node-cron, a separate worker process, or a platform scheduler). PRD only requires it runs daily.

## Filter Presets Design Notes

- Presets are per-user (not shared org-wide in v1)
- Stored in DB as `{ user_id, name, filter_json }` — `filter_json` serializes the full filter state
- UI consideration: preset list in a collapsible sidebar or dropdown adjacent to the filter panel
- v2 consideration: shared/org-wide presets, or preset pinning

## Rejected Alternatives

| Decision | Alternative | Reason Rejected |
|----------|-------------|-----------------|
| Prisma ORM | Drizzle | Drizzle has less mature SQLite migration support; Prisma codegen is better for TypeScript safety |
| Soft-delete for employees | Hard-delete | Hard-delete destroys audit trail and salary history; non-negotiable for compliance |
| JWT auth | Session cookies only | JWTs are stateless and better suited for a decoupled Next.js + Express architecture |
| Single HR role | Two roles (Admin/Viewer) | Least-privilege principle; read-only analysts should not have write access to salary data |
