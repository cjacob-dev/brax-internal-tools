import { beforeEach, describe, expect, it } from "vitest";
import { signOut, switchUser } from "@/platform/auth/actions";
import { PermissionDeniedError } from "@/platform/auth/require-permission";
import { signSession, verifySession } from "@/platform/auth/session-token";
import { auditEventsFor, createUser, session } from "./helpers";

function form(userId: string) {
  const fd = new FormData();
  fd.set("userId", userId);
  return fd;
}

describe("signed session cookie", () => {
  it("round-trips a signed user id", () => {
    expect(verifySession(signSession("usr_ops_01"))).toBe("usr_ops_01");
  });

  it.each([
    ["unsigned", "usr_admin_01"],
    ["tampered user id", signSession("usr_ops_01").replace("usr_ops_01", "usr_admin_01")],
    ["bad signature", "usr_admin_01.AAAA"],
    ["empty", ""],
  ])("rejects a %s cookie", (_label, token) => {
    expect(verifySession(token)).toBeNull();
  });
});

describe("mock SSO user switcher", () => {
  beforeEach(() => {
    session.userId = null;
    process.env.MOCK_AUTH_ENABLED = "true";
  });

  it("is denied when mock auth is disabled: no session, ACCESS_DENIED audited", async () => {
    delete process.env.MOCK_AUTH_ENABLED;
    const user = await createUser("admin");
    await expect(switchUser(form(user.id))).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(session.userId).toBeNull();
    const [event] = await auditEventsFor({ action: "ACCESS_DENIED", entityType: "Session", entityId: user.id });
    expect(JSON.parse(event.after!)).toEqual({ code: "MOCK_AUTH_DISABLED" });
  });

  it("denies unknown users", async () => {
    await expect(switchUser(form("usr_does_not_exist"))).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(session.userId).toBeNull();
    expect(await auditEventsFor({ action: "ACCESS_DENIED", entityType: "Session", entityId: "usr_does_not_exist" })).not.toHaveLength(0);
  });

  it("switches user with SIGNED_IN (before = previous user) and signs out with SIGNED_OUT", async () => {
    const first = await createUser("ops_analyst");
    const second = await createUser("compliance_reviewer");
    await expect(switchUser(form(first.id))).rejects.toThrow("NEXT_REDIRECT:/");
    await expect(switchUser(form(second.id))).rejects.toThrow("NEXT_REDIRECT:/");
    expect(session.userId).toBe(second.id);
    const [event] = await auditEventsFor({ actorId: second.id, action: "SIGNED_IN" });
    expect(event.actorRole).toBe("compliance_reviewer");
    expect(JSON.parse(event.before!)).toEqual({ userId: first.id, role: "ops_analyst" });

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(session.userId).toBeNull();
    expect(await auditEventsFor({ actorId: second.id, action: "SIGNED_OUT" })).toHaveLength(1);
  });
});
