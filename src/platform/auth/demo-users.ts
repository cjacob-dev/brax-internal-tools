import { db } from "@/platform/db";
import { isMockAuthEnabled } from "./session";

/** Users listed in the mock SSO switcher. Empty when mock auth is disabled. */
export async function listSwitchableUsers() {
  if (!isMockAuthEnabled()) return [];
  return db.user.findMany({ select: { id: true, name: true, role: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
}
