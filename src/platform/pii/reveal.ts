import { UserFacingError } from "@/platform/actions";
import { recordAudit } from "@/platform/audit/record-audit";
import { requirePermission } from "@/platform/auth/require-permission";

export const PII_REVEALED = "PII_REVEALED";

export type RevealRequest = {
  app: string;
  entity: { type: string; id: string };
  field: string;
  reason: string;
  /** Loads the raw value. Only called after the permission check passes. */
  load: () => Promise<string | null>;
};

/**
 * Permission-gated (kyc:reveal_pii), audited PII reveal. Call from an app's server action.
 * The audit event records who revealed which field and why, never the value.
 */
export async function revealPII(request: RevealRequest): Promise<string | null> {
  const actor = await requirePermission("kyc:reveal_pii");
  const reason = request.reason?.trim();
  if (!reason) throw new UserFacingError("A reason is required to reveal PII");
  const value = await request.load();
  await recordAudit({
    actor,
    app: request.app,
    action: PII_REVEALED,
    entity: request.entity,
    before: null,
    after: { field: request.field },
    reason,
  });
  return value;
}
