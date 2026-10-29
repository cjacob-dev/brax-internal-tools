import type { PrismaClient } from "@prisma/client";
import { KYC_ACTIONS, KYC_APP_ID, KYC_ENTITY, SLA_HOURS, tierForScore, type CustomerType, type KycDocument, type KycStatus, type Recommendation } from "../src/apps/kyc/domain";
import { SEED_USERS } from "./seed-users";

/**
 * Deterministic, entirely fictional KYC cases: a fixed PRNG seed and fixed ids, with all
 * dates relative to `now`, so every `npm run demo:reset` produces the same demo state.
 * Tax IDs use a made-up `<country>-TIN-<9 digits>` format (never SSN-shaped).
 */
const RANDOM_SEED = 20261029;
const HOUR = 3_600_000;

const OPS = ["usr_ops_01", "usr_ops_02"] as const;
const REVIEWERS = ["usr_comp_01", "usr_comp_02"] as const;
const ROLE_OF = new Map<string, string>(SEED_USERS.map((u) => [u.id, u.role]));

export const DEMO_CASE_IDS = { northwind: "kyc_demo_northwind", averyChen: "kyc_demo_avery_chen", overdue: "kyc_demo_overdue" } as const;

const FIRST = ["Priya", "Mateo", "Lena", "Kwame", "Sofia", "Hiro", "Amara", "Lucas", "Noor", "Elena", "Tomas", "Yuki", "Ines", "Rafael", "Zara", "Omar"];
const LAST = ["Lindqvist", "Okafor", "Moreau", "Tanaka", "Alvarez", "Novak", "Haddad", "Brennan", "Kowalski", "Santos", "Ferreira", "Castellano", "Whitfield", "Abernathy"];
const BIZ_A = ["Bluefin", "Cedar", "Harbor", "Summit", "Granite", "Juniper", "Copper", "Meridian", "Pinecrest", "Redwood", "Tidewater", "Ironbridge"];
const BIZ_B = ["Analytics", "Logistics", "Foods", "Robotics", "Textiles", "Capital Partners", "Supply", "Labs", "Freight", "Ceramics"];
const BIZ_C = ["LLC", "Inc", "Ltd", "GmbH", "Pte Ltd"];
const COUNTRIES = ["US", "GB", "DE", "CA", "SG", "NL", "IE", "AU", "MX", "FR"];

const RECOMMEND_REASONS: Record<Recommendation, string[]> = {
  APPROVE: [
    "Identity and address documents verified; no sanctions or PEP hits.",
    "Ownership structure confirmed against registry extract; activity matches profile.",
    "All documents verified and screening clear.",
  ],
  REJECT: [
    "Proof of address does not match the declared residence.",
    "Beneficial owner could not be verified after two requests.",
    "Adverse media hit not resolved by the customer's explanation.",
  ],
};
const ESCALATION_NOTES = [
  "Escalated to MLRO: high-risk jurisdiction exposure reviewed, enhanced due diligence completed.",
  "Senior compliance sign-off obtained after enhanced due diligence on source of funds.",
];
const DECISION_REASONS = { APPROVED: ["Agree with analyst recommendation; evidence is complete.", "Approved after reviewing screening results."], REJECTED: ["Agree with analyst: verification incomplete.", "Rejected: unresolved discrepancies in documentation."] };

/** 40 generated statuses, then shuffled deterministically. */
const STATUS_MIX: KycStatus[] = [
  ...Array<KycStatus>(12).fill("NEW"),
  ...Array<KycStatus>(8).fill("IN_REVIEW"),
  ...Array<KycStatus>(8).fill("PENDING_APPROVAL"),
  ...Array<KycStatus>(3).fill("ESCALATED"),
  ...Array<KycStatus>(5).fill("APPROVED"),
  ...Array<KycStatus>(4).fill("REJECTED"),
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SeedCase = {
  id: string;
  customerName: string;
  customerType: CustomerType;
  country: string;
  riskScore: number;
  riskTier: string;
  taxId: string;
  documents: string;
  status: KycStatus;
  claimedBy: string | null;
  recommendedBy: string | null;
  recommendation: Recommendation | null;
  recommendationReason: string | null;
  escalationNote: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: Date;
  slaDueAt: Date;
};

export type SeedAuditEvent = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  app: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  reason: string | null;
  createdAt: Date;
};

type Spec = {
  id: string;
  name: string;
  type: CustomerType;
  country: string;
  score: number;
  status: KycStatus;
  /** Hours from now until the SLA is due (negative = overdue). Open cases only. */
  dueInHours?: number;
  /** Hours ago the case was opened. Closed cases only. */
  openedHoursAgo?: number;
  claimedBy?: string;
  recommendedBy?: string;
  recommendation?: Recommendation;
  recommendationReason?: string;
  escalationNote?: string;
  decidedBy?: string;
  decisionReason?: string;
  docStatuses?: KycDocument["status"][];
};

function documentsFor(id: string, type: CustomerType, statuses: KycDocument["status"][]): KycDocument[] {
  const kinds = type === "individual" ? ["PASSPORT", "PROOF_OF_ADDRESS", "SELFIE"] : ["CERTIFICATE_OF_INCORPORATION", "BENEFICIAL_OWNERSHIP", "BANK_STATEMENT"];
  return kinds.map((kind, i) => ({ type: kind, fileName: `${id}_${kind.toLowerCase()}.${kind === "SELFIE" ? "jpg" : "pdf"}`, status: statuses[i] ?? "VERIFIED" }));
}

export function buildKycSeed(now: Date = new Date()): { cases: SeedCase[]; events: SeedAuditEvent[] } {
  const rand = mulberry32(RANDOM_SEED);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");

  const statuses = [...STATUS_MIX];
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
  }

  const usedNames = new Set(["Northwind Trading LLC", "Avery Chen", "Silverline Imports Ltd"]);
  const uniqueName = (type: CustomerType) => {
    for (;;) {
      const name = type === "individual" ? `${pick(FIRST)} ${pick(LAST)}` : `${pick(BIZ_A)} ${pick(BIZ_B)} ${pick(BIZ_C)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
  };

  let overdueBudget = 5;
  const specs: Spec[] = statuses.map((status, i) => {
    const id = `kyc_${String(i + 1).padStart(4, "0")}`;
    const type: CustomerType = rand() < 0.55 ? "individual" : "business";
    const bucket = i % 3;
    const score = bucket === 0 ? int(8, 39) : bucket === 1 ? int(40, 69) : int(70, 97);
    const tier = tierForScore(score);
    const open = status !== "APPROVED" && status !== "REJECTED";
    const overdue = open && status !== "ESCALATED" && overdueBudget > 0 && rand() < 0.3;
    if (overdue) overdueBudget--;
    const spec: Spec = {
      id,
      name: uniqueName(type),
      type,
      country: pick(COUNTRIES),
      score,
      status,
      dueInHours: open ? (overdue ? -int(2, 30) : int(2, SLA_HOURS[tier] - 2)) : undefined,
      openedHoursAgo: open ? undefined : int(72, 336),
    };
    if (status === "NEW") spec.docStatuses = [pick(["VERIFIED", "PENDING"] as const), "PENDING", pick(["PENDING", "MISSING"] as const)];
    if (status === "IN_REVIEW") spec.docStatuses = ["VERIFIED", pick(["VERIFIED", "PENDING"] as const), "PENDING"];
    if (status !== "NEW") spec.claimedBy = rand() < 0.85 ? pick(OPS) : "usr_comp_02";
    if (status === "PENDING_APPROVAL" || status === "ESCALATED" || status === "APPROVED" || status === "REJECTED") {
      spec.recommendedBy = spec.claimedBy;
      spec.recommendation = status === "REJECTED" ? "REJECT" : rand() < 0.8 ? "APPROVE" : "REJECT";
      spec.recommendationReason = pick(RECOMMEND_REASONS[spec.recommendation]);
    }
    if (status === "ESCALATED" || ((status === "APPROVED" || status === "REJECTED") && tier === "HIGH")) spec.escalationNote = pick(ESCALATION_NOTES);
    if (status === "APPROVED" || status === "REJECTED") {
      const eligible = REVIEWERS.filter((r) => r !== spec.recommendedBy);
      spec.decidedBy = pick(eligible);
      spec.decisionReason = pick(DECISION_REASONS[status]);
      if (status === "REJECTED") spec.docStatuses = ["VERIFIED", "MISSING", "VERIFIED"];
    }
    return spec;
  });

  specs.push(
    {
      id: DEMO_CASE_IDS.northwind,
      name: "Northwind Trading LLC",
      type: "business",
      country: "US",
      score: 86,
      status: "PENDING_APPROVAL",
      dueInHours: 6,
      claimedBy: REVIEWERS[0],
      recommendedBy: REVIEWERS[0],
      recommendation: "APPROVE",
      recommendationReason: "Beneficial ownership verified against registry; trade volumes consistent with stated business.",
    },
    { id: DEMO_CASE_IDS.averyChen, name: "Avery Chen", type: "individual", country: "CA", score: 52, status: "NEW", dueInHours: 40, docStatuses: ["VERIFIED", "PENDING", "PENDING"] },
    {
      id: DEMO_CASE_IDS.overdue,
      name: "Silverline Imports Ltd",
      type: "business",
      country: "GB",
      score: 63,
      status: "IN_REVIEW",
      dueInHours: -72,
      claimedBy: OPS[1],
      docStatuses: ["VERIFIED", "PENDING", "VERIFIED"],
    },
  );

  const cases: SeedCase[] = [];
  const events: SeedAuditEvent[] = [];
  for (const s of specs) {
    const tier = tierForScore(s.score);
    const slaDueAt = s.dueInHours !== undefined ? new Date(now.getTime() + s.dueInHours * HOUR) : new Date(now.getTime() - s.openedHoursAgo! * HOUR + SLA_HOURS[tier] * HOUR);
    const createdAt = s.dueInHours !== undefined ? new Date(slaDueAt.getTime() - SLA_HOURS[tier] * HOUR) : new Date(now.getTime() - s.openedHoursAgo! * HOUR);
    cases.push({
      id: s.id,
      customerName: s.name,
      customerType: s.type,
      country: s.country,
      riskScore: s.score,
      riskTier: tier,
      taxId: `${s.country}-TIN-${digits(9)}`,
      documents: JSON.stringify(documentsFor(s.id, s.type, s.docStatuses ?? [])),
      status: s.status,
      claimedBy: s.claimedBy ?? null,
      recommendedBy: s.recommendedBy ?? null,
      recommendation: s.recommendation ?? null,
      recommendationReason: s.recommendationReason ?? null,
      escalationNote: s.escalationNote ?? null,
      decidedBy: s.decidedBy ?? null,
      decisionReason: s.decisionReason ?? null,
      createdAt,
      slaDueAt,
    });

    // Timeline: the same events the server actions write, spread between opening and now.
    const end = s.dueInHours !== undefined ? now.getTime() - 0.5 * HOUR : createdAt.getTime() + (s.openedHoursAgo! - 24) * HOUR;
    const steps: { action: string; actor: string | null; before: object | null; after: object; reason: string | null }[] = [
      { action: KYC_ACTIONS.opened, actor: null, before: null, after: { status: "NEW", riskTier: tier, riskScore: s.score }, reason: null },
    ];
    if (s.claimedBy) steps.push({ action: KYC_ACTIONS.claimed, actor: s.claimedBy, before: { status: "NEW", claimedBy: null }, after: { status: "IN_REVIEW", claimedBy: s.claimedBy }, reason: null });
    if (s.recommendedBy)
      steps.push({
        action: KYC_ACTIONS.recommended,
        actor: s.recommendedBy,
        before: { status: "IN_REVIEW", recommendedBy: null, recommendation: null },
        after: { status: "PENDING_APPROVAL", recommendedBy: s.recommendedBy, recommendation: s.recommendation },
        reason: s.recommendationReason ?? null,
      });
    if (s.escalationNote) {
      const escalator = s.decidedBy ?? REVIEWERS.find((r) => r !== s.recommendedBy)!;
      steps.push({ action: KYC_ACTIONS.escalated, actor: escalator, before: { status: "PENDING_APPROVAL", escalationNote: null }, after: { status: "ESCALATED", escalationNote: s.escalationNote }, reason: s.escalationNote });
    }
    if (s.decidedBy) {
      const from = s.escalationNote ? "ESCALATED" : "PENDING_APPROVAL";
      steps.push({ action: s.status === "APPROVED" ? KYC_ACTIONS.approved : KYC_ACTIONS.rejected, actor: s.decidedBy, before: { status: from, decidedBy: null }, after: { status: s.status, decidedBy: s.decidedBy }, reason: s.decisionReason ?? null });
    }
    const span = Math.max(end - createdAt.getTime(), steps.length * 60_000);
    steps.forEach((step, n) => {
      events.push({
        id: `seed_${s.id}_${n + 1}`,
        actorId: step.actor,
        actorRole: step.actor ? (ROLE_OF.get(step.actor) ?? null) : null,
        app: KYC_APP_ID,
        action: step.action,
        entityType: KYC_ENTITY,
        entityId: s.id,
        before: step.before ? JSON.stringify(step.before) : null,
        after: JSON.stringify(step.after),
        reason: step.reason,
        createdAt: new Date(createdAt.getTime() + Math.round((span * n) / steps.length)),
      });
    });
  }
  return { cases, events };
}

export async function seedKycCases(client: Pick<PrismaClient, "kycCase" | "auditEvent">, now: Date = new Date()) {
  if ((await client.kycCase.count()) > 0) return { cases: 0, events: 0, skipped: true };
  const { cases, events } = buildKycSeed(now);
  await client.kycCase.createMany({ data: cases });
  await client.auditEvent.createMany({ data: events });
  return { cases: cases.length, events: events.length, skipped: false };
}
