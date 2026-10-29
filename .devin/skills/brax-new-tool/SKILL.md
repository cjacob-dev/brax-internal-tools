---
name: "brax-new-tool"
description: "Add a new internal tool to the Brax internal-tools platform, with the same permissions, audit, and PII controls as every existing app."
---

Goal: add a new internal tool to the Brax internal-tools platform, with the same permissions, audit, and PII controls as every existing app.
1. Read src/platform and one existing app in src/apps before writing code.
2. Add Prisma models and a migration. Add realistic fake seed data (20-40 rows), deterministic, and include it in npm run demo:reset.
3. Add any new permissions and roles to the central permission map.
4. Build the app under src/apps/<name>/ using shared components (DataTable, StatusBadge, ConfirmWithReasonDialog, PageHeader).
5. Every mutation: requirePermission() + recordAudit(). Any approval step enforces that the approver is not the requester, on the server.
6. Register the app in src/apps/registry.ts.
7. Tests: permission denied for the wrong role, audit event written on each mutation, approval separation if applicable.
8. Update the README apps table. Open a PR with a summary and screenshots.
Do not: change platform code unless required (explain why in the PR), add new auth, or write to the database outside server actions.
