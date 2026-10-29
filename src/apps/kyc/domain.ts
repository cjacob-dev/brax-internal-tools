/** Pure KYC domain rules, shared by server actions, queries, and the seed. No imports from "@/". */

export const KYC_APP_ID = "kyc";
export const KYC_ENTITY = "KycCase";

export const KYC_STATUSES = ["NEW", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ESCALATED"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const RISK_TIERS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const CUSTOMER_TYPES = ["individual", "business"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const RECOMMENDATIONS = ["APPROVE", "REJECT"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

/** Statuses a compliance reviewer can approve or reject from. */
export const DECIDABLE_STATUSES: readonly KycStatus[] = ["PENDING_APPROVAL", "ESCALATED"];
export const CLOSED_STATUSES: readonly KycStatus[] = ["APPROVED", "REJECTED"];

export const KYC_ACTIONS = {
  opened: "KYC_CASE_OPENED",
  claimed: "KYC_CASE_CLAIMED",
  recommended: "KYC_RECOMMENDATION_SUBMITTED",
  escalated: "KYC_CASE_ESCALATED",
  approved: "KYC_CASE_APPROVED",
  rejected: "KYC_CASE_REJECTED",
  /** Not a state change: a decision the server refused (four-eyes or missing escalation note). */
  decisionBlocked: "KYC_DECISION_BLOCKED",
} as const;

/** Review SLA from case creation, by tier. */
export const SLA_HOURS: Record<RiskTier, number> = { HIGH: 24, MEDIUM: 72, LOW: 120 };

export function tierForScore(score: number): RiskTier {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function isKycStatus(value: unknown): value is KycStatus {
  return typeof value === "string" && (KYC_STATUSES as readonly string[]).includes(value);
}

export function isRiskTier(value: unknown): value is RiskTier {
  return typeof value === "string" && (RISK_TIERS as readonly string[]).includes(value);
}

export function isRecommendation(value: unknown): value is Recommendation {
  return typeof value === "string" && (RECOMMENDATIONS as readonly string[]).includes(value);
}

export function isClosed(status: string): boolean {
  return (CLOSED_STATUSES as readonly string[]).includes(status);
}

export type KycDocument = { type: string; fileName: string; status: "VERIFIED" | "PENDING" | "MISSING" };

export function parseDocuments(json: string): KycDocument[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export const MIN_REASON_LENGTH = 5;
