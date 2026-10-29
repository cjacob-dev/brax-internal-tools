import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_FALLBACK_SECRET = "dev-only-insecure-session-secret";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return DEV_FALLBACK_SECRET;
}

function hmac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Session cookie value: `<userId>.<HMAC-SHA256(userId)>`. */
export function signSession(userId: string): string {
  return `${userId}.${hmac(userId)}`;
}

/** Returns the user id if the signature is valid, otherwise null. */
export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(hmac(userId));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
