import { describe, expect, it } from "vitest";
import { isClosed, tierForScore } from "@/apps/kyc/domain";
import { describeDeadline } from "@/platform/ui/deadline";
import { buildKycSeed, DEMO_CASE_IDS } from "../prisma/seed-kyc";

const now = new Date("2026-10-29T12:00:00Z");
const { cases, events } = buildKycSeed(now);
const byId = (id: string) => cases.find((c) => c.id === id)!;

describe("KYC demo seed", () => {
  it("is deterministic: same output for the same clock, and dates move with the clock", () => {
    expect(buildKycSeed(now)).toEqual({ cases, events });
    const later = buildKycSeed(new Date(now.getTime() + 86_400_000));
    expect(later.cases.map((c) => [c.id, c.customerName, c.status, c.taxId])).toEqual(cases.map((c) => [c.id, c.customerName, c.status, c.taxId]));
    expect(later.cases[0].slaDueAt.getTime() - cases[0].slaDueAt.getTime()).toBe(86_400_000);
  });

  it("has 40 generated cases plus the 3 named demo cases, across every tier and status", () => {
    expect(cases).toHaveLength(43);
    expect(new Set(cases.map((c) => c.id)).size).toBe(43);
    expect(new Set(cases.map((c) => c.customerName)).size).toBe(43);
    expect(new Set(cases.map((c) => c.riskTier))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
    expect(new Set(cases.map((c) => c.status))).toEqual(new Set(["NEW", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ESCALATED"]));
    for (const c of cases) expect(c.riskTier, c.id).toBe(tierForScore(c.riskScore));
  });

  it("seeds the named demo cases in the requested state", () => {
    expect(byId(DEMO_CASE_IDS.northwind)).toMatchObject({
      customerName: "Northwind Trading LLC",
      customerType: "business",
      riskTier: "HIGH",
      status: "PENDING_APPROVAL",
      recommendedBy: "usr_comp_01",
      escalationNote: null,
    });
    expect(byId(DEMO_CASE_IDS.averyChen)).toMatchObject({ customerName: "Avery Chen", customerType: "individual", riskTier: "MEDIUM", status: "NEW", claimedBy: null });
  });

  it("has some open cases past SLA, and the named overdue case sorts first with a red badge", () => {
    const open = cases.filter((c) => !isClosed(c.status)).sort((a, b) => a.slaDueAt.getTime() - b.slaDueAt.getTime());
    expect(open[0].id).toBe(DEMO_CASE_IDS.overdue);
    expect(describeDeadline(open[0].slaDueAt, now)).toMatchObject({ overdue: true, tone: "danger", label: "Overdue 3d 0h" });
    expect(open.filter((c) => c.slaDueAt < now).length).toBeGreaterThan(2);
  });

  it("respects the workflow rules: four-eyes, HIGH-risk escalation notes, and past-only audit events", () => {
    for (const c of cases) {
      if (c.decidedBy) expect(c.decidedBy, c.id).not.toBe(c.recommendedBy);
      if (c.decidedBy && c.riskTier === "HIGH") expect(c.escalationNote, c.id).toBeTruthy();
      expect(c.createdAt.getTime(), c.id).toBeLessThan(now.getTime());
    }
    for (const e of events) expect(e.createdAt.getTime(), e.id).toBeLessThanOrEqual(now.getTime());
    const last = (id: string) => events.filter((e) => e.entityId === id).at(-1)!;
    for (const c of cases) expect(JSON.parse(last(c.id).after!).status, c.id).toBe(c.status);
  });

  it("uses fake tax IDs that are never SSN-shaped", () => {
    for (const c of cases) {
      expect(c.taxId).toMatch(/^[A-Z]{2}-TIN-\d{9}$/);
      expect(c.taxId).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    }
  });
});

describe("describeDeadline", () => {
  const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
  it.each([
    [-50, "Overdue 2d 2h", "danger"],
    [-0.5, "Overdue 30m", "danger"],
    [5.5, "5h 30m left", "warning"],
    [30, "1d 6h left", "neutral"],
  ] as const)("%sh -> %s (%s)", (hours, label, tone) => {
    expect(describeDeadline(at(hours), now)).toMatchObject({ label, tone });
  });
});
