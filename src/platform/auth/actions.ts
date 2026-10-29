"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/platform/audit/record-audit";
import { db } from "@/platform/db";
import { getCurrentActor } from "./actor";
import { PermissionDeniedError } from "./require-permission";
import { clearSession, isMockAuthEnabled, setSessionUserId } from "./session";

/**
 * Mock SSO user switcher. The one unauthenticated mutation in the platform: there is
 * no actor yet, so it cannot call requirePermission(). It is denied unless mock auth is
 * explicitly enabled outside production. Real OIDC replaces this; see session.ts.
 */
export async function switchUser(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const previous = await getCurrentActor();
  const user = isMockAuthEnabled() && userId ? await db.user.findUnique({ where: { id: userId } }) : null;
  if (!user) {
    await recordAudit({
      actor: previous,
      app: "platform",
      action: "ACCESS_DENIED",
      entity: { type: "Session", id: userId || null },
      before: null,
      after: { code: isMockAuthEnabled() ? "UNKNOWN_USER" : "MOCK_AUTH_DISABLED" },
      reason: null,
    });
    throw new PermissionDeniedError("session:switch", "NOT_GRANTED");
  }
  await setSessionUserId(user.id);
  await recordAudit({
    actor: { id: user.id, role: user.role },
    app: "platform",
    action: "SIGNED_IN",
    entity: { type: "Session", id: user.id },
    before: previous ? { userId: previous.id, role: previous.role } : null,
    after: { userId: user.id, role: user.role, method: "mock" },
    reason: null,
  });
  redirect("/");
}

export async function signOut(): Promise<void> {
  const actor = await getCurrentActor();
  await clearSession();
  if (actor) {
    await recordAudit({
      actor,
      app: "platform",
      action: "SIGNED_OUT",
      entity: { type: "Session", id: actor.id },
      before: { userId: actor.id, role: actor.role },
      after: null,
      reason: null,
    });
  }
  redirect("/");
}
