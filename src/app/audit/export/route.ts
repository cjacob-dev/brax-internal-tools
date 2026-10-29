import { toCsv } from "@/apps/audit/csv";
import { cleanFilters, findAuditEvents } from "@/apps/audit/queries";
import { recordAudit } from "@/platform/audit/record-audit";
import { PermissionDeniedError, requirePermission } from "@/platform/auth/require-permission";

export const dynamic = "force-dynamic";

const HEADER = ["id", "createdAt", "actorId", "actorRole", "app", "action", "entityType", "entityId", "before", "after", "reason"] as const;

/** CSV export of the filtered audit log. The export itself is audited (AUDIT_EXPORTED). */
export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission("audit:export");
  } catch (error) {
    if (error instanceof PermissionDeniedError) return new Response("Forbidden", { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
    throw error;
  }
  const filters = cleanFilters(Object.fromEntries(new URL(request.url).searchParams));
  const events = await findAuditEvents(filters);
  await recordAudit({
    actor,
    app: "audit",
    action: "AUDIT_EXPORTED",
    entity: { type: "AuditEvent", id: null },
    before: null,
    after: { filters, rowCount: events.length },
    reason: null,
  });
  const csv = toCsv(
    HEADER,
    events.map((e) => [e.id, e.createdAt.toISOString(), e.actorId, e.actorRole, e.app, e.action, e.entityType, e.entityId, e.before, e.after, e.reason]),
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
