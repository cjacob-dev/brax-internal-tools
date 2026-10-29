import { requirePermission } from "@/platform/auth/require-permission";
import { db } from "@/platform/db";
import { maskPII } from "@/platform/pii/mask";
import { isClosed, isKycStatus, isRiskTier, KYC_APP_ID, KYC_ENTITY, parseDocuments, type KycStatus, type RiskTier } from "./domain";

export type KycFilters = { status?: KycStatus; tier?: RiskTier };

export function cleanKycFilters(raw: Record<string, string | string[] | undefined>): KycFilters {
  const pick = (k: string) => {
    const v = raw[k];
    return (Array.isArray(v) ? v[0] : v)?.trim();
  };
  const status = pick("status");
  const tier = pick("tier");
  return { status: isKycStatus(status) ? status : undefined, tier: isRiskTier(tier) ? tier : undefined };
}

async function userNames() {
  const users = await db.user.findMany({ select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return (id: string | null) => (id ? (names.get(id) ?? id) : null);
}

/** Queue rows. Tax IDs are never selected here. */
export async function listKycCases(filters: KycFilters) {
  const actor = await requirePermission("kyc:read");
  const [cases, nameOf] = await Promise.all([
    db.kycCase.findMany({
      where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.tier ? { riskTier: filters.tier } : {}) },
      omit: { taxId: true },
      orderBy: [{ slaDueAt: "asc" }, { id: "asc" }],
    }),
    userNames(),
  ]);
  return { actor, cases: cases.map((c) => ({ ...c, claimedByName: nameOf(c.claimedBy), slaOpen: !isClosed(c.status) })) };
}

/** Case detail with the tax ID masked on the server, plus a timeline built from audit events. */
export async function getKycCase(id: string) {
  const actor = await requirePermission("kyc:read");
  const [row, events, nameOf] = await Promise.all([
    db.kycCase.findUnique({ where: { id } }),
    db.auditEvent.findMany({ where: { app: KYC_APP_ID, entityType: KYC_ENTITY, entityId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    userNames(),
  ]);
  if (!row) return { actor, kycCase: null, timeline: [] };
  const { taxId, documents, ...rest } = row;
  return {
    actor,
    kycCase: {
      ...rest,
      taxIdMasked: maskPII(taxId),
      documents: parseDocuments(documents),
      claimedByName: nameOf(row.claimedBy),
      recommendedByName: nameOf(row.recommendedBy),
      decidedByName: nameOf(row.decidedBy),
    },
    timeline: events.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      action: e.action,
      actorName: nameOf(e.actorId) ?? "System",
      actorRole: e.actorRole,
      reason: e.reason,
      fromStatus: statusOf(e.before),
      toStatus: statusOf(e.after),
    })),
  };
}

function statusOf(json: string | null): string | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return typeof value?.status === "string" ? value.status : null;
  } catch {
    return null;
  }
}
