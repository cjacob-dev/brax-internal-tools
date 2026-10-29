# Build log

One row per session. Times come from the system clock (`date -u`) and are never estimated. See [AGENTS.md](AGENTS.md#session-build-log-every-session).

| Session | Goal | Started (UTC) | Finished (UTC) | Duration | PR | Tests | Issues and fixes |
|---|---|---|---|---|---|---|---|
| 0 (backfilled) | Conventions setup: agree repo conventions; plan the platform foundation | 2026-10-29 13:44 (session start time from the Devin environment; minute precision) | 2026-10-29 13:45:13 (Devin memory commit `f629242` that saved the conventions, made right before the hand-off message) | ~1 min (seconds not recorded at start) | none (no code) | n/a | Backfilled in Session 1 from clock artifacts; no `date -u` was run during Session 0. The repo was empty (README only), so none of the referenced platform primitives existed yet; planned them for Session 1. |
| 1 | Platform foundation: Next.js + Prisma/SQLite + mock auth + Vitest; requirePermission, append-only recordAudit, maskPII/revealPII, shared UI, app registry, Audit log app, demo:reset, AGENTS.md, CI | 2026-10-29 13:48:48 (first clock artifact: Node install dir mtime; the build log was requested after work started) | _in progress_ | | | | |
