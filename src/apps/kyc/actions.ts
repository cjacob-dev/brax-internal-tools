"use server";

import type { Prisma } from "@prisma/client";
import { toActionError, UserFacingError, type ActionResult } from "@/platform/actions";
import { recordAudit } from "@/platform/audit/record-audit";
import type { Actor } from "@/platform/auth/actor";
import { requirePermission } from "@/platform/auth/require-permission";
import { db } from "@/platform/db";
import { revealPII } from "@/platform/pii/reveal";
import { DECIDABLE_STATUSES, isRecommendation, KYC_ACTIONS, KYC_APP_ID, KYC_ENTITY, MIN_REASON_LENGTH, type KycStatus, type Recommendation } from "./domain";

export async function claimCase(caseId: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("kyc:recommend");
    await transition(actor, caseId, {
      where: { status: "NEW", claimedBy: null },
      data: { status: "IN_REVIEW", claimedBy: actor.id },
      action: KYC_ACTIONS.claimed,
      reason: null,
      conflict: "This case is no longer unclaimed.",
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function submitRecommendation(caseId: string, recommendation: Recommendation, reason: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("kyc:recommend");
    if (!isRecommendation(recommendation)) throw new UserFacingError("Recommendation must be APPROVE or REJECT.");
    const why = requireReason(reason);
    await transition(actor, caseId, {
      where: { status: "IN_REVIEW", claimedBy: actor.id },
      data: { status: "PENDING_APPROVAL", recommendedBy: actor.id, recommendation, recommendationReason: why },
      action: KYC_ACTIONS.recommended,
      reason: why,
      conflict: "Only the analyst who claimed this case can recommend, and only while it is in review.",
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function escalateCase(caseId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("kyc:decide");
    const why = requireReason(note, "An escalation note");
    await transition(actor, caseId, {
      where: { status: "PENDING_APPROVAL" },
      data: { status: "ESCALATED", escalationNote: why },
      action: KYC_ACTIONS.escalated,
      reason: why,
      conflict: "Only cases pending approval can be escalated.",
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Final approve/reject. Server-side rules, independent of role:
 *  - four-eyes: the decider cannot be the recommender;
 *  - HIGH risk cases need an escalation note on file before a decision.
 * Refusals are audited as KYC_DECISION_BLOCKED.
 */
export async function decideCase(caseId: string, decision: "APPROVED" | "REJECTED", reason: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("kyc:decide");
    if (decision !== "APPROVED" && decision !== "REJECTED") throw new UserFacingError("Decision must be APPROVED or REJECTED.");
    const why = requireReason(reason);
    const current = await db.kycCase.findUnique({ where: { id: caseId } });
    if (!current) throw new UserFacingError("Case not found.");
    if (!(DECIDABLE_STATUSES as readonly string[]).includes(current.status)) throw new UserFacingError("This case is not awaiting a decision.");
    if (current.recommendedBy === actor.id) {
      await blockDecision(actor, current.id, decision, "FOUR_EYES", "Four-eyes rule: the decider cannot be the recommender.");
      throw new UserFacingError("Four-eyes rule: you recommended this case, so another compliance reviewer must decide it.");
    }
    if (current.riskTier === "HIGH" && !current.escalationNote?.trim()) {
      await blockDecision(actor, current.id, decision, "ESCALATION_NOTE_REQUIRED", "HIGH risk case has no escalation note.");
      throw new UserFacingError("HIGH risk cases require an escalation note before a decision. Escalate the case first.");
    }
    await transition(actor, caseId, {
      where: {
        status: { in: [...DECIDABLE_STATUSES] },
        recommendedBy: { not: actor.id },
        ...(current.riskTier === "HIGH" ? { escalationNote: { not: null } } : {}),
      },
      data: { status: decision, decidedBy: actor.id, decisionReason: why },
      action: decision === "APPROVED" ? KYC_ACTIONS.approved : KYC_ACTIONS.rejected,
      reason: why,
      conflict: "This case changed while you were deciding. Reload and try again.",
    });
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revealTaxId(caseId: string, reason: string): Promise<ActionResult<string | null>> {
  try {
    const value = await revealPII({
      app: KYC_APP_ID,
      entity: { type: KYC_ENTITY, id: caseId },
      field: "taxId",
      reason,
      load: async () => (await db.kycCase.findUnique({ where: { id: caseId }, select: { taxId: true } }))?.taxId ?? null,
    });
    return { ok: true, data: value };
  } catch (error) {
    return toActionError(error);
  }
}

function requireReason(reason: string, label = "A reason"): string {
  const why = typeof reason === "string" ? reason.trim() : "";
  if (why.length < MIN_REASON_LENGTH) throw new UserFacingError(`${label} of at least ${MIN_REASON_LENGTH} characters is required.`);
  return why.slice(0, 1000);
}

const WORKFLOW_FIELDS = ["status", "claimedBy", "recommendedBy", "recommendation", "escalationNote", "decidedBy"] as const;

function snapshot(row: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
}

/**
 * Guarded state change: the update only applies if the case still matches `where`
 * (compare-and-set), and the audit event commits in the same transaction.
 */
async function transition(
  actor: Actor,
  caseId: string,
  change: { where: Prisma.KycCaseWhereInput; data: Prisma.KycCaseUpdateManyMutationInput & { status: KycStatus }; action: string; reason: string | null; conflict: string },
) {
  await db.$transaction(async (tx) => {
    const before = await tx.kycCase.findUnique({ where: { id: caseId } });
    if (!before) throw new UserFacingError("Case not found.");
    const { count } = await tx.kycCase.updateMany({ where: { ...change.where, id: caseId }, data: change.data });
    if (count !== 1) throw new UserFacingError(change.conflict);
    const keys = WORKFLOW_FIELDS.filter((k) => k === "status" || k in change.data);
    await recordAudit(
      {
        actor,
        app: KYC_APP_ID,
        action: change.action,
        entity: { type: KYC_ENTITY, id: caseId },
        before: snapshot(before, keys),
        after: snapshot({ ...before, ...change.data }, keys),
        reason: change.reason,
      },
      tx,
    );
  });
}

async function blockDecision(actor: Actor, caseId: string, decision: string, code: string, reason: string) {
  await recordAudit({
    actor,
    app: KYC_APP_ID,
    action: KYC_ACTIONS.decisionBlocked,
    entity: { type: KYC_ENTITY, id: caseId },
    before: null,
    after: { attempted: decision, code },
    reason,
  });
}
