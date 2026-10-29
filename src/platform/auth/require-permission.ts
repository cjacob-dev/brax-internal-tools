import { recordAudit } from "@/platform/audit/record-audit";
import { getCurrentActor, type Actor } from "./actor";
import { isKnownPermission, roleHasPermission, type Permission } from "./permissions";

export type DenialCode = "UNAUTHENTICATED" | "UNKNOWN_PERMISSION" | "NOT_GRANTED";

export class PermissionDeniedError extends Error {
  constructor(
    readonly permission: string,
    readonly code: DenialCode,
  ) {
    super(`Permission denied: ${permission} (${code})`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Must be the first call in every server action, route handler, and protected page/query.
 * Deny by default: no session, unknown user, unknown permission, or a role without the
 * grant all throw. Every denial is audited as ACCESS_DENIED.
 */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await getCurrentActor();
  const code: DenialCode | null = !isKnownPermission(permission)
    ? "UNKNOWN_PERMISSION"
    : !actor
      ? "UNAUTHENTICATED"
      : !roleHasPermission(actor.role, permission)
        ? "NOT_GRANTED"
        : null;
  if (code || !actor) {
    await recordAudit({
      actor,
      app: "platform",
      action: "ACCESS_DENIED",
      entity: { type: "Permission", id: permission },
      before: null,
      after: { permission, code: code ?? "UNAUTHENTICATED" },
      reason: null,
    });
    throw new PermissionDeniedError(permission, code ?? "UNAUTHENTICATED");
  }
  return actor;
}
