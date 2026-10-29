import { beforeEach, describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, roleHasPermission, type Permission } from "@/platform/auth/permissions";
import { PermissionDeniedError, requirePermission } from "@/platform/auth/require-permission";
import { db } from "@/platform/db";
import { auditEventsFor, session, signInAsUser } from "./helpers";

beforeEach(() => {
  session.userId = null;
});

describe("requirePermission: deny by default", () => {
  it("denies an unauthenticated caller and audits ACCESS_DENIED", async () => {
    const before = await db.auditEvent.count({ where: { action: "ACCESS_DENIED", actorId: null } });
    await expect(requirePermission("audit:read")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await db.auditEvent.count({ where: { action: "ACCESS_DENIED", actorId: null } })).toBe(before + 1);
  });

  it("denies a session for a user that no longer exists", async () => {
    session.userId = "usr_deleted";
    await expect(requirePermission("audit:read")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it.each([
    ["ops_analyst", "kyc:decide"],
    ["ops_analyst", "kyc:reveal_pii"],
    ["ops_analyst", "audit:read"],
    ["compliance_reviewer", "audit:read"],
    ["admin", "kyc:read"],
    ["admin", "kyc:decide"],
  ] as const)("denies %s -> %s and records role and permission", async (role, permission) => {
    const user = await signInAsUser(role);
    await expect(requirePermission(permission)).rejects.toBeInstanceOf(PermissionDeniedError);
    const [event] = await auditEventsFor({ actorId: user.id, action: "ACCESS_DENIED" });
    expect(event).toMatchObject({ app: "platform", actorRole: role, entityType: "Permission", entityId: permission });
    expect(JSON.parse(event.after!)).toEqual({ permission, code: "NOT_GRANTED" });
  });

  it("denies an unknown role", async () => {
    await signInAsUser("superuser");
    await expect(requirePermission("audit:read")).rejects.toMatchObject({ code: "NOT_GRANTED" });
  });

  it("denies an unknown permission even for admin", async () => {
    await signInAsUser("admin");
    await expect(requirePermission("audit:delete" as Permission)).rejects.toMatchObject({ code: "UNKNOWN_PERMISSION" });
  });

  it("allows a granted role and writes no denial", async () => {
    const user = await signInAsUser("compliance_reviewer");
    await expect(requirePermission("kyc:decide")).resolves.toMatchObject({ id: user.id, role: "compliance_reviewer" });
    expect(await auditEventsFor({ actorId: user.id, action: "ACCESS_DENIED" })).toHaveLength(0);
  });

  it("the central map grants exactly what the spec lists", () => {
    const granted = Object.fromEntries(ROLES.map((r) => [r, PERMISSIONS.filter((p) => roleHasPermission(r, p))]));
    expect(granted).toEqual({
      ops_analyst: ["kyc:read", "kyc:recommend"],
      compliance_reviewer: ["kyc:read", "kyc:recommend", "kyc:decide", "kyc:reveal_pii"],
      admin: ["audit:read", "audit:export"],
    });
  });
});
