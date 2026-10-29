import type { PrismaClient } from "@prisma/client";

/**
 * Deterministic, entirely fictional users with fixed ids so demos and screenshots
 * are reproducible. Never use real names, SSNs, or account numbers.
 */
export const SEED_USERS = [
  { id: "usr_ops_01", name: "Riley Ops", email: "riley.ops@example.com", role: "ops_analyst" },
  { id: "usr_ops_02", name: "Jordan Ops", email: "jordan.ops@example.com", role: "ops_analyst" },
  { id: "usr_comp_01", name: "Morgan Compliance", email: "morgan.compliance@example.com", role: "compliance_reviewer" },
  { id: "usr_comp_02", name: "Taylor Compliance", email: "taylor.compliance@example.com", role: "compliance_reviewer" },
  { id: "usr_admin_01", name: "Avery Admin", email: "avery.admin@example.com", role: "admin" },
] as const;

export async function seedUsers(client: Pick<PrismaClient, "user">) {
  for (const u of SEED_USERS) {
    await client.user.upsert({ where: { id: u.id }, update: u, create: u });
  }
}
