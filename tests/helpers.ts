import { randomUUID } from "node:crypto";
import { db } from "@/platform/db";

/** Mutable mock session. tests/session-mock.ts points @/platform/auth/session here. */
export const session: { userId: string | null } = { userId: null };

export async function createUser(role: string) {
  const id = `test_${randomUUID()}`;
  return db.user.create({ data: { id, email: `${id}@example.com`, name: "Test User", role } });
}

export async function signInAsUser(role: string) {
  const user = await createUser(role);
  session.userId = user.id;
  return user;
}

export function auditEventsFor(where: { actorId?: string | null; action?: string; app?: string; entityType?: string; entityId?: string | null }) {
  return db.auditEvent.findMany({ where, orderBy: { createdAt: "asc" } });
}
