import { PermissionDeniedError } from "@/platform/auth/require-permission";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Converts thrown errors into a safe client-facing result. Never leaks internals. */
export function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof PermissionDeniedError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. The error has been logged." };
}

/** Throw for validation/business-rule failures whose message is safe to show users. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
