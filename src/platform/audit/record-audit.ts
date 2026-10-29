import { db } from "@/platform/db";
import { redactPIIFields } from "@/platform/pii/mask";

export type AuditInput = {
  actor: { id: string; role: string } | null;
  /** Registry app id, or "platform" for platform-level events. */
  app: string;
  action: string;
  entity: { type: string; id?: string | null };
  before: unknown;
  after: unknown;
  reason: string | null;
};

/** `db` or the client passed to a `db.$transaction(async (tx) => ...)` callback. */
export type AuditWriter = { auditEvent: { create: (typeof db)["auditEvent"]["create"] } };

function toJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(redactPIIFields(value));
}

/**
 * Appends an audit event. The only write path to AuditEvent; there is no update or delete.
 * Pass the transaction client so the event commits atomically with the mutation.
 * Known PII fields in before/after are masked before storage.
 */
export async function recordAudit(input: AuditInput, client: AuditWriter = db) {
  if (!input.app || !input.action || !input.entity?.type) {
    throw new Error("recordAudit: app, action, and entity.type are required");
  }
  return client.auditEvent.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorRole: input.actor?.role ?? null,
      app: input.app,
      action: input.action,
      entityType: input.entity.type,
      entityId: input.entity.id ?? null,
      before: toJson(input.before),
      after: toJson(input.after),
      reason: input.reason,
    },
  });
}
