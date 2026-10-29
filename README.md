# Brax Internal Tools

A time-boxed prototype of an internal-tools platform for **Brax**, a fictional Series C fintech (~60 engineers) evaluating whether to replace Microsoft Power Apps. It favors simplicity and clarity over completeness.

The platform gives every internal app the same guardrails: mock SSO with role-based access (deny by default), an append-only audit log, PII masking with audited reveal, and shared UI components. There are no business apps yet; the first one (a KYC review queue) comes next. Contributor and agent rules are in [AGENTS.md](AGENTS.md); per-session timing is in [BUILD_LOG.md](BUILD_LOG.md).

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma 6 + SQLite · Vitest

## How to run

Requires Node 20+.

```bash
# 1. Install
npm install

# 2. Configure (set SESSION_SECRET: openssl rand -base64 32)
cp .env.example .env

# 3. Migrate (creates prisma/dev.db)
npx prisma migrate deploy

# 4. Seed the fake demo users
npm run db:seed

# 5. Run
npm run dev            # http://localhost:3000
```

`npm run demo:reset` does steps 3 and 4 in one go: it drops the database, reapplies every migration, and reseeds.

Pick a user from the **Signed in as** switcher in the header. All users are fictional:

| User | Role | Permissions |
|---|---|---|
| Riley Ops, Jordan Ops | `ops_analyst` | `kyc:read`, `kyc:recommend` |
| Morgan Compliance, Taylor Compliance | `compliance_reviewer` | `kyc:read`, `kyc:decide`, `kyc:reveal_pii` |
| Avery Admin | `admin` | `audit:read`, `audit:export` |

Admin deliberately has no `kyc:*` permissions, so the person who reviews the audit trail can't also make KYC decisions.

## Apps

| App | Route | Required permission | Description |
|---|---|---|---|
| Audit log | `/audit` | `audit:read` | Append-only history of every mutation, access denial, PII reveal, and export. Filter by app and entity; CSV export needs `audit:export` and is itself audited. |

## Architecture

```
src/
  app/                    Next.js routes (thin): layout with header + sidebar, /audit, /audit/export, /forbidden
  apps/
    registry.ts           Every app: id, name, description, route, requiredPermission
    audit/                Audit log app (page, queries, CSV)
  platform/
    auth/                 Mock SSO session, central RBAC map, requirePermission()
    audit/                recordAudit()
    pii/                  maskPII(), revealPII()
    ui/                   Shared components
    db.ts                 Prisma client with append-only guard for AuditEvent
prisma/                   Schema, migrations (incl. audit triggers), deterministic seed
tests/                    Vitest suites against a throwaway SQLite DB
```

**Request flow.** Every page, query, server action, and route handler starts with `requirePermission(permission)`. It reads the signed session cookie, looks up the user, and checks the role against the single map in `src/platform/auth/permissions.ts`. Anything not explicitly granted (no session, unknown user, unknown permission, missing grant) is denied, and the denial is written to the audit log as `ACCESS_DENIED`.

**Mock SSO.** The header switcher sets a `brax_session` cookie signed with HMAC-SHA256 (`SESSION_SECRET`). It only works when `MOCK_AUTH_ENABLED=true` outside production. The comment in `src/platform/auth/session.ts` marks where real OIDC (Okta or Entra ID) plugs in: validate the ID token, map IdP groups to roles, issue the same session.

**Audit log.** `recordAudit()` writes `AuditEvent` rows (id, actorId, actorRole, app, action, entityType, entityId, before, after, reason, createdAt) and accepts a transaction client so a change and its audit row commit together. The table is append-only, enforced three ways: a Prisma client extension rejects update/delete, SQLite triggers reject raw `UPDATE`/`DELETE`, and a conventions test fails the build if such code appears.

**PII.** `maskPII()` shows only the last 4 characters. `recordAudit()` masks known PII fields in before/after payloads. `revealPII()` requires `kyc:reveal_pii` plus a reason and writes `PII_REVEALED` (recording the field, never the value).

**Shared UI** (`src/platform/ui`): `PageHeader`, `DataTable` (sort, filter, paginate), `StatusBadge`, `ConfirmWithReasonDialog` (reason required), `MaskedValue`, `Button`, `Card`. Styled with Tailwind on a neutral zinc palette; the header wordmark is plain text.

**Sidebar.** Built from the registry, showing only apps whose `requiredPermission` the current user has.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:migrate` | Create a new migration in development (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations |
| `npm run db:seed` | Seed the fake users |
| `npm run demo:reset` | Drop the DB, apply all migrations, reseed |
| `npm test` | Vitest against a throwaway `prisma/test.db` |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
