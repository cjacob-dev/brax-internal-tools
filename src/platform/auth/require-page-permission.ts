import { redirect } from "next/navigation";
import type { Actor } from "./actor";
import type { Permission } from "./permissions";
import { PermissionDeniedError, requirePermission } from "./require-permission";

/** Page-level guard: redirects instead of throwing so users see a friendly screen. */
export async function requirePagePermission(permission: Permission): Promise<Actor> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/" : "/forbidden");
    }
    throw error;
  }
}
