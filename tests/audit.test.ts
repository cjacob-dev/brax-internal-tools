import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { recordAudit, type AuditInput } from "@/platform/audit/record-audit";
import { AuditImmutableError, db } from "@/platform/db";
import { createUser } from "./helpers";

const base = (overrides: Partial<AuditInput> = {}): AuditInput => ({
  actor: null,
  app: "test",
  action: "TEST_EVENT",
  entity: { type: "TestEntity", id: randomUUID() },
  before: null,
  after: null,
  reason: null,
  ...overrides,
});

async function writeEvent() {
  const user = await createUser("compliance_reviewer");
  const entityId = randomUUID();
  const event = await recordAudit(
    base({ actor: user, action: "TEST_UPDATED", entity: { type: "TestEntity", id: entityId }, before: { status: "PENDING" }, after: { status: "APPROVED" }, reason: "Verified documents" }),
  );
  return { user, entityId, event };
}

describe("recordAudit", () => {
  it("writes actorId, actorRole, app, action, entity, before/after JSON, reason, createdAt", async () => {
    const { user, entityId, event } = await writeEvent();
    const stored = await db.auditEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored).toMatchObject({
      actorId: user.id,
      actorRole: "compliance_reviewer",
      app: "test",
      action: "TEST_UPDATED",
      entityType: "TestEntity",
      entityId,
      reason: "Verified documents",
    });
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(JSON.parse(stored.before!)).toEqual({ status: "PENDING" });
    expect(JSON.parse(stored.after!)).toEqual({ status: "APPROVED" });
  });

  it("masks PII fields in before/after payloads", async () => {
    const event = await recordAudit(base({ after: { ssn: "900-12-3456", accountNumber: "000123456789", nested: { dateOfBirth: "1990-01-02" }, status: "OK" } }));
    const after = JSON.parse(event.after!);
    expect(after.ssn).toBe("•••••••3456");
    expect(after.accountNumber).toBe("••••••••6789");
    expect(after.nested.dateOfBirth).toBe("••••••1-02");
    expect(after.status).toBe("OK");
    expect(event.after).not.toContain("900-12");
  });

  it("rejects events missing app, action, or entity type", async () => {
    await expect(recordAudit(base({ app: "" }))).rejects.toThrow();
    await expect(recordAudit(base({ action: "" }))).rejects.toThrow();
    await expect(recordAudit(base({ entity: { type: "" } }))).rejects.toThrow();
  });

  it("commits atomically with the caller's transaction", async () => {
    const entityId = randomUUID();
    await expect(
      db.$transaction(async (tx) => {
        await recordAudit(base({ entity: { type: "TestEntity", id: entityId } }), tx);
        throw new Error("mutation failed");
      }),
    ).rejects.toThrow("mutation failed");
    expect(await db.auditEvent.count({ where: { entityId } })).toBe(0);
  });
});

describe("AuditEvent is append-only", () => {
  it("blocks update/delete through the Prisma client", async () => {
    const { event } = await writeEvent();
    await expect(db.auditEvent.update({ where: { id: event.id }, data: { reason: "tampered" } })).rejects.toBeInstanceOf(AuditImmutableError);
    await expect(db.auditEvent.updateMany({ data: { reason: "tampered" } })).rejects.toBeInstanceOf(AuditImmutableError);
    await expect(db.auditEvent.delete({ where: { id: event.id } })).rejects.toBeInstanceOf(AuditImmutableError);
    await expect(db.auditEvent.deleteMany({})).rejects.toBeInstanceOf(AuditImmutableError);
  });

  it("blocks raw SQL update/delete with database triggers", async () => {
    const { event } = await writeEvent();
    await expect(db.$executeRaw`UPDATE "AuditEvent" SET "reason" = 'tampered' WHERE "id" = ${event.id}`).rejects.toThrow(/append-only/);
    await expect(db.$executeRaw`DELETE FROM "AuditEvent" WHERE "id" = ${event.id}`).rejects.toThrow(/append-only/);
    expect((await db.auditEvent.findUniqueOrThrow({ where: { id: event.id } })).reason).toBe("Verified documents");
  });
});
