import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionDeniedError } from "@/platform/auth/require-permission";
import { PII_REVEALED, revealPII } from "@/platform/pii/reveal";
import { auditEventsFor, session, signInAsUser } from "./helpers";

const FAKE_SSN = "900-00-1234";
const request = (overrides: Partial<Parameters<typeof revealPII>[0]> = {}) => ({
  app: "test",
  entity: { type: "Customer", id: randomUUID() },
  field: "ssn",
  reason: "Identity check for case",
  load: async () => FAKE_SSN,
  ...overrides,
});

beforeEach(() => {
  session.userId = null;
});

describe("revealPII", () => {
  it.each(["ops_analyst", "admin"])("denies %s, never loads the value, writes no PII_REVEALED", async (role) => {
    const user = await signInAsUser(role);
    const load = vi.fn(async () => FAKE_SSN);
    await expect(revealPII(request({ load }))).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(load).not.toHaveBeenCalled();
    expect(await auditEventsFor({ actorId: user.id, action: PII_REVEALED })).toHaveLength(0);
    expect(await auditEventsFor({ actorId: user.id, action: "ACCESS_DENIED" })).toHaveLength(1);
  });

  it("requires a reason", async () => {
    const user = await signInAsUser("compliance_reviewer");
    await expect(revealPII(request({ reason: "  " }))).rejects.toThrow(/reason/);
    expect(await auditEventsFor({ actorId: user.id, action: PII_REVEALED })).toHaveLength(0);
  });

  it("returns the value and writes PII_REVEALED with field and reason, never the value", async () => {
    const user = await signInAsUser("compliance_reviewer");
    const req = request();
    expect(await revealPII(req)).toBe(FAKE_SSN);
    const [event] = await auditEventsFor({ actorId: user.id, action: PII_REVEALED });
    expect(event).toMatchObject({ app: "test", actorRole: "compliance_reviewer", entityType: "Customer", entityId: req.entity.id, reason: req.reason });
    expect(JSON.parse(event.after!)).toEqual({ field: "ssn" });
    expect(JSON.stringify(event)).not.toContain(FAKE_SSN);
  });
});
