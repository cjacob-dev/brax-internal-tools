import { cookies } from "next/headers";
import { signSession, verifySession } from "./session-token";

export const SESSION_COOKIE = "brax_session";

/*
 * MOCK SSO. This is where real OIDC (Okta or Entra ID) plugs in:
 *   - Replace setSessionUserId() with the OIDC callback handler (e.g. Auth.js with the
 *     Okta or Microsoft Entra ID provider) that validates the ID token, maps the IdP
 *     group claim to a Role in permissions.ts, and issues the session.
 *   - Replace getSessionUserId() with the library's session lookup.
 * Nothing else in the platform reads cookies, so the swap is contained to this file
 * and the header user switcher (which is removed).
 */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionUserId(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The mock user switcher only works when explicitly enabled, and never in production. */
export function isMockAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH_ENABLED === "true";
}
