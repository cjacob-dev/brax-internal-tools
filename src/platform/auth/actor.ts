import { db } from "@/platform/db";
import { roleHasPermission, type Permission } from "./permissions";
import { getSessionUserId } from "./session";

export type Actor = { id: string; name: string; email: string; role: string };

export async function getCurrentActor(): Promise<Actor | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

export function hasPermission(actor: Actor | null, permission: Permission): boolean {
  return actor !== null && roleHasPermission(actor.role, permission);
}
