# AGENTS.md

Rules for every change to this repo, whether a person or an agent (Devin) makes it. This is an internal-tools platform prototype for a fintech evaluating a replacement for Microsoft Power Apps, so treat security and auditability as requirements, not nice-to-haves.

## Session build log (every session)

1. **Start:** run `date -u` and add a new row to [BUILD_LOG.md](BUILD_LOG.md) with the session name, goal, and start time.
2. **End:** run `date -u` again and fill in the finish time, duration, PR link, test result (pass/fail and count), and anything that went wrong and how it was fixed.
3. **Never estimate times.** Always use the system clock. If a time has to be reconstructed after the fact, say which clock artifact it came from and mark it backfilled.
4. Commit the BUILD_LOG.md update in that session's PR so git history backs up the timestamps.

## Mutations

- Every mutation is a **server action or route handler** whose first call is `requirePermission()` (`src/platform/auth/require-permission.ts`). Access is denied by default: no session, an unknown user, an unknown permission, or a role without the grant all deny, and every denial is audited as `ACCESS_DENIED`.
- Every mutation calls `recordAudit()` (`src/platform/audit/record-audit.ts`) with actor (id + role), app (the registry id), action, entity, before/after JSON, and reason. Pass the transaction client (`db.$transaction(async (tx) => ...)`) so the audit row commits atomically with the change.
- The audit table is **append-only**. Never write update or delete code for `AuditEvent`. A Prisma client extension (`src/platform/db.ts`) and SQLite triggers (init migration) both reject it, and `tests/conventions.test.ts` fails if such code appears.
- Never write to the database from pages, components, or query modules. Reads live in `src/apps/<app>/queries.ts` and call `requirePermission()` too.
- The only unauthenticated mutation is the mock SSO user switcher (`src/platform/auth/actions.ts`). It is allowlisted in the conventions test and gated by `MOCK_AUTH_ENABLED=true` outside production. Do not add more. Real OIDC (Okta or Entra ID) plugs in at `src/platform/auth/session.ts`.
- Business-rule separation (e.g. approver is not the requester) is enforced on the server, never only in the UI.

## PII

- Never display raw PII. Render `maskPII(value)` (`src/platform/pii/mask.ts`, shows the last 4 characters only), or `<MaskedValue>` for revealable fields.
- Revealing PII goes through `revealPII()` (`src/platform/pii/reveal.ts`). It requires `kyc:reveal_pii` and a reason, and it writes a `PII_REVEALED` audit event that records the field, never the value.
- `recordAudit()` masks known PII keys (`PII_FIELDS`) in before/after payloads. Add new PII field names there.

## UI

- Use the shared components in `src/platform/ui` (`PageHeader`, `DataTable`, `StatusBadge`, `ConfirmWithReasonDialog`, `MaskedValue`, `Button`, `Card`) before creating new ones. If a component is reusable, add it there.
- Style with Tailwind utility classes on the neutral zinc palette. The header wordmark is the plain text "Brax Internal Tools" (Brax is fictional). Don't imitate any real company's logo, colors, or brand.
- Don't add new UI libraries (component kits, icon packs, other CSS frameworks) unless the PR justifies it.

## Apps

- Each app lives in `src/apps/<app-id>/`, with thin route files under `src/app/<route>/` (e.g. `src/app/audit/page.tsx`).
- Every app registers in `src/apps/registry.ts` with its `requiredPermission`; the sidebar shows only apps the current user can access. New permissions and role grants go in `src/platform/auth/permissions.ts`, the single central map.
- Add the app to the Apps table in README.md.

## Data

- Seed data is fake and deterministic (fixed ids). Never use real names, SSNs, account numbers, or real email domains (use `example.com`). The conventions test rejects SSN-shaped strings in `prisma/seed*`.
- Every schema change ships as a Prisma migration. `npm run demo:reset` must rebuild the full demo dataset.

## Pull requests

- Every PR includes tests for **permission denial** (the wrong role is denied) and **audit writes** (each mutation writes its event), plus a short summary of what changed.
- Before pushing, run `npm run lint && npm run typecheck && npm test && npm run build`.
