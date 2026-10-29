import { vi } from "vitest";
import { session } from "./helpers";

vi.mock("@/platform/auth/session", () => ({
  SESSION_COOKIE: "brax_session",
  getSessionUserId: async () => session.userId,
  setSessionUserId: async (id: string) => {
    session.userId = id;
  },
  clearSession: async () => {
    session.userId = null;
  },
  isMockAuthEnabled: () => process.env.MOCK_AUTH_ENABLED === "true",
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { redirectUrl: url });
  },
}));
