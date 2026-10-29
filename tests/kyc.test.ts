import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { claimCase, decideCase, escalateCase, revealTaxId, submitRecommendation } from "@/apps/kyc/actions";
import { KYC_ACTIONS } from "@/apps/kyc/domain";
import { getKycCase, listKycCases } from "@/apps/kyc/queries";
import { requirePagePermission } from "@/platform/auth/require-page-permission";
import { db } from "@/platform/db";
import { PII_REVEALED } from "@/platform/pii/reveal";
import { auditEventsFor, createUser, session } from "./helpers";

const TAX_ID = "US-TIN-900112233";
const REASON = "Documents verified against registry";
const NOTE = "Enhanced due diligence completed with MLRO";

async function createCase(overrides: Partial<Parameters<typeof db.kycCase.create>[0]["data"]> = {}) {
  return db.kycCase.create({
    data: {
      id: `kyc_test_${randomUUID()}`,
      customerName: "Test Customer Ltd",
      customerType: "business",
      country: "US",
      riskScore: 55,
      riskTier: "MEDIUM",
      taxId: TAX_ID,
      documents: "[]",
      status: "NEW",
      slaDueAt: new Date(Date.now() + 3_600_000),
      ...overrides,
    },
  });
}

const as = (user: { id: string }) => {
  session.userId = user.id;
};
const kycEvents = (entityId: string) => auditEventsFor({ app: "kyc", entityType: "KycCase", entityId });
const statusOf = async (id: string) => (await db.kycCase.findUniqueOrThrow({ where: { id } })).status;

/** Claimed and recommended by `recommender`, now PENDING_APPROVAL. */
async function pendingCase(recommender: { id: string }, overrides: Parameters<typeof createCase>[0] = {}) {
  const c = await createCase(overrides);
  as(recommender);
  expect(await claimCase(c.id)).toEqual({ ok: true, data: undefined });
  expect(await submitRecommendation(c.id, "APPROVE", REASON)).toEqual({ ok: true, data: undefined });
  return c;
}

beforeEach(() => {
  session.userId = null;
});

describe("KYC: wrong role is denied", () => {
  it("admin cannot read the queue or a case; the attempt is audited", async () => {
    const admin = await createUser("admin");
    as(admin);
    await expect(listKycCases({})).rejects.toMatchObject({ code: "NOT_GRANTED" });
    await expect(getKycCase("anything")).rejects.toMatchObject({ code: "NOT_GRANTED" });
    await expect(requirePagePermission("kyc:read")).rejects.toThrow("NEXT_REDIRECT:/forbidden");
    expect(await auditEventsFor({ actorId: admin.id, action: "ACCESS_DENIED" })).toHaveLength(3);
  });

  it("admin cannot claim or recommend", async () => {
    const admin = await createUser("admin");
    const c = await createCase();
    as(admin);
    expect(await claimCase(c.id)).toEqual({ ok: false, error: "You do not have permission to do that." });
    expect(await submitRecommendation(c.id, "APPROVE", REASON)).toMatchObject({ ok: false });
    expect(await statusOf(c.id)).toBe("NEW");
    expect(await kycEvents(c.id)).toHaveLength(0);
  });

  it("ops_analyst cannot escalate, approve, or reject; nothing changes and denials are audited", async () => {
    const analyst = await createUser("ops_analyst");
    const c = await pendingCase(analyst);
    const eventsBefore = (await kycEvents(c.id)).length;
    expect(await escalateCase(c.id, NOTE)).toMatchObject({ ok: false });
    expect(await decideCase(c.id, "APPROVED", REASON)).toMatchObject({ ok: false });
    expect(await decideCase(c.id, "REJECTED", REASON)).toMatchObject({ ok: false });
    expect(await statusOf(c.id)).toBe("PENDING_APPROVAL");
    expect(await kycEvents(c.id)).toHaveLength(eventsBefore);
    const denials = await auditEventsFor({ actorId: analyst.id, action: "ACCESS_DENIED" });
    expect(denials.map((d) => d.entityId)).toEqual(["kyc:decide", "kyc:decide", "kyc:decide"]);
  });

  it("only the analyst who claimed a case can recommend on it", async () => {
    const [a, b] = [await createUser("ops_analyst"), await createUser("ops_analyst")];
    const c = await createCase();
    as(a);
    await claimCase(c.id);
    as(b);
    expect(await claimCase(c.id)).toEqual({ ok: false, error: "This case is no longer unclaimed." });
    expect(await submitRecommendation(c.id, "APPROVE", REASON)).toMatchObject({ ok: false });
    expect(await statusOf(c.id)).toBe("IN_REVIEW");
  });

  it("rejects a recommendation without a real reason", async () => {
    const a = await createUser("ops_analyst");
    const c = await createCase();
    as(a);
    await claimCase(c.id);
    expect(await submitRecommendation(c.id, "APPROVE", "  ok ")).toMatchObject({ ok: false, error: expect.stringMatching(/reason/i) });
    expect(await statusOf(c.id)).toBe("IN_REVIEW");
  });
});

describe("KYC: four-eyes rule (server-side)", () => {
  it("a compliance reviewer who recommended cannot decide, even with kyc:decide; the attempt is audited", async () => {
    const [morgan, taylor] = [await createUser("compliance_reviewer"), await createUser("compliance_reviewer")];
    const c = await pendingCase(morgan);
    as(morgan);
    for (const decision of ["APPROVED", "REJECTED"] as const) {
      const result = await decideCase(c.id, decision, REASON);
      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/four-eyes/i) });
    }
    const after = await db.kycCase.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({ status: "PENDING_APPROVAL", decidedBy: null, decisionReason: null });
    const blocked = await auditEventsFor({ actorId: morgan.id, action: KYC_ACTIONS.decisionBlocked, entityId: c.id });
    expect(blocked.map((e) => JSON.parse(e.after!))).toEqual([
      { attempted: "APPROVED", code: "FOUR_EYES" },
      { attempted: "REJECTED", code: "FOUR_EYES" },
    ]);

    as(taylor);
    expect(await decideCase(c.id, "APPROVED", REASON)).toEqual({ ok: true, data: undefined });
    expect(await db.kycCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "APPROVED", decidedBy: taylor.id, recommendedBy: morgan.id });
  });

  it("HIGH risk cases need an escalation note before a decision", async () => {
    const [analyst, reviewer] = [await createUser("ops_analyst"), await createUser("compliance_reviewer")];
    const c = await pendingCase(analyst, { riskScore: 88, riskTier: "HIGH" });
    as(reviewer);
    expect(await decideCase(c.id, "APPROVED", REASON)).toMatchObject({ ok: false, error: expect.stringMatching(/escalation note/i) });
    expect(await statusOf(c.id)).toBe("PENDING_APPROVAL");
    const [blocked] = await auditEventsFor({ actorId: reviewer.id, action: KYC_ACTIONS.decisionBlocked, entityId: c.id });
    expect(JSON.parse(blocked.after!)).toEqual({ attempted: "APPROVED", code: "ESCALATION_NOTE_REQUIRED" });

    expect(await escalateCase(c.id, NOTE)).toEqual({ ok: true, data: undefined });
    expect(await decideCase(c.id, "REJECTED", REASON)).toEqual({ ok: true, data: undefined });
    expect(await db.kycCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "REJECTED", escalationNote: NOTE });
  });

  it("a closed case cannot be decided again", async () => {
    const [analyst, reviewer] = [await createUser("ops_analyst"), await createUser("compliance_reviewer")];
    const c = await pendingCase(analyst);
    as(reviewer);
    await decideCase(c.id, "APPROVED", REASON);
    expect(await decideCase(c.id, "REJECTED", REASON)).toMatchObject({ ok: false });
    expect(await statusOf(c.id)).toBe("APPROVED");
  });
});

describe("KYC: every state change writes an audit event", () => {
  it("claim -> recommend -> escalate -> approve writes one event per change with before/after, actor, and reason", async () => {
    const [analyst, reviewer] = [await createUser("ops_analyst"), await createUser("compliance_reviewer")];
    const c = await createCase({ riskScore: 91, riskTier: "HIGH" });
    as(analyst);
    await claimCase(c.id);
    await submitRecommendation(c.id, "REJECT", REASON);
    as(reviewer);
    await escalateCase(c.id, NOTE);
    await decideCase(c.id, "APPROVED", "Overriding: discrepancy explained");

    const events = await kycEvents(c.id);
    expect(events.map((e) => [e.action, e.actorId, e.actorRole])).toEqual([
      [KYC_ACTIONS.claimed, analyst.id, "ops_analyst"],
      [KYC_ACTIONS.recommended, analyst.id, "ops_analyst"],
      [KYC_ACTIONS.escalated, reviewer.id, "compliance_reviewer"],
      [KYC_ACTIONS.approved, reviewer.id, "compliance_reviewer"],
    ]);
    expect(events.map((e) => [JSON.parse(e.before!).status, JSON.parse(e.after!).status])).toEqual([
      ["NEW", "IN_REVIEW"],
      ["IN_REVIEW", "PENDING_APPROVAL"],
      ["PENDING_APPROVAL", "ESCALATED"],
      ["ESCALATED", "APPROVED"],
    ]);
    expect(JSON.parse(events[1].after!)).toEqual({ status: "PENDING_APPROVAL", recommendedBy: analyst.id, recommendation: "REJECT" });
    expect(events.map((e) => e.reason)).toEqual([null, REASON, NOTE, "Overriding: discrepancy explained"]);
    for (const e of events) expect(JSON.stringify(e)).not.toContain(TAX_ID);
  });

  it("the case timeline is built from those audit events", async () => {
    const [analyst, reviewer] = [await createUser("ops_analyst"), await createUser("compliance_reviewer")];
    const c = await pendingCase(analyst);
    as(reviewer);
    await decideCase(c.id, "REJECTED", REASON);
    const { timeline } = await getKycCase(c.id);
    expect(timeline.map((t) => [t.action, t.fromStatus, t.toStatus, t.actorName])).toEqual([
      [KYC_ACTIONS.claimed, "NEW", "IN_REVIEW", "Test User"],
      [KYC_ACTIONS.recommended, "IN_REVIEW", "PENDING_APPROVAL", "Test User"],
      [KYC_ACTIONS.rejected, "PENDING_APPROVAL", "REJECTED", "Test User"],
    ]);
  });
});

describe("KYC: tax ID is masked and reveal is audited", () => {
  it("queries never return the raw tax ID", async () => {
    const c = await createCase();
    as(await createUser("ops_analyst"));
    const detail = await getKycCase(c.id);
    expect(detail.kycCase?.taxIdMasked).toBe("••••••••••••2233");
    expect(JSON.stringify(detail)).not.toContain(TAX_ID);
    const { cases } = await listKycCases({});
    expect(JSON.stringify(cases)).not.toContain(TAX_ID);
  });

  it("ops_analyst cannot reveal; no PII_REVEALED is written", async () => {
    const analyst = await createUser("ops_analyst");
    const c = await createCase();
    as(analyst);
    expect(await revealTaxId(c.id, "Need to verify")).toMatchObject({ ok: false });
    expect(await auditEventsFor({ action: PII_REVEALED, entityId: c.id })).toHaveLength(0);
    expect(await auditEventsFor({ actorId: analyst.id, action: "ACCESS_DENIED", entityId: "kyc:reveal_pii" })).toHaveLength(1);
  });

  it("compliance_reviewer reveal returns the value and writes PII_REVEALED (field + reason, never the value)", async () => {
    const reviewer = await createUser("compliance_reviewer");
    const c = await createCase();
    as(reviewer);
    expect(await revealTaxId(c.id, "  ")).toMatchObject({ ok: false });
    expect(await revealTaxId(c.id, "Match against W-9 on file")).toEqual({ ok: true, data: TAX_ID });
    const events = await auditEventsFor({ action: PII_REVEALED, entityId: c.id });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ app: "kyc", entityType: "KycCase", actorId: reviewer.id, reason: "Match against W-9 on file" });
    expect(JSON.parse(events[0].after!)).toEqual({ field: "taxId" });
    expect(JSON.stringify(events[0])).not.toContain(TAX_ID);
    expect((await getKycCase(c.id)).timeline.map((t) => t.action)).toEqual([PII_REVEALED]);
  });
});

describe("KYC queue filters", () => {
  it("filters by status and risk tier", async () => {
    await createCase({ status: "ESCALATED", riskTier: "LOW", riskScore: 10, recommendedBy: "x", escalationNote: NOTE });
    as(await createUser("compliance_reviewer"));
    const { cases } = await listKycCases({ status: "ESCALATED", tier: "LOW" });
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((c) => c.status === "ESCALATED" && c.riskTier === "LOW")).toBe(true);
  });
});
