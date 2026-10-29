import type { AuditEvent } from "@prisma/client";
import { requirePermission } from "@/platform/auth/require-permission";
import { db } from "@/platform/db";

export const AUDIT_MAX_ROWS = 1000;

export type AuditFilters = { app?: string; entityType?: string; entityId?: string };

export function cleanFilters(raw: Record<string, string | string[] | null | undefined>): AuditFilters {
  const pick = (k: string) => {
    const v = raw[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s.slice(0, 200) : undefined;
  };
  return { app: pick("app"), entityType: pick("entityType"), entityId: pick("entityId") };
}

/** Unchecked query; callers must have already called requirePermission(). */
export async function findAuditEvents(filters: AuditFilters): Promise<AuditEvent[]> {
  return db.auditEvent.findMany({
    where: {
      ...(filters.app ? { app: filters.app } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_MAX_ROWS,
  });
}

export async function listAuditEvents(filters: AuditFilters) {
  await requirePermission("audit:read");
  const [events, apps, entityTypes, users] = await Promise.all([
    findAuditEvents(filters),
    db.auditEvent.findMany({ distinct: ["app"], select: { app: true }, orderBy: { app: "asc" } }),
    db.auditEvent.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    events: events.map((e) => ({ ...e, actorName: e.actorId ? (names.get(e.actorId) ?? e.actorId) : null })),
    apps: apps.map((a) => a.app),
    entityTypes: entityTypes.map((e) => e.entityType),
  };
}
