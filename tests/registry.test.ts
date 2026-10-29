import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { apps } from "@/apps/registry";
import { isKnownPermission, ROLE_PERMISSIONS } from "@/platform/auth/permissions";

describe("app registry", () => {
  it("every app requires a known permission that at least one role grants", () => {
    for (const app of apps) {
      expect(isKnownPermission(app.requiredPermission), app.id).toBe(true);
      expect(Object.values(ROLE_PERMISSIONS).some((perms) => perms.includes(app.requiredPermission)), app.id).toBe(true);
    }
  });

  it("ids and routes are unique and every route has a page", () => {
    expect(new Set(apps.map((a) => a.id)).size).toBe(apps.length);
    expect(new Set(apps.map((a) => a.route)).size).toBe(apps.length);
    for (const app of apps) expect(existsSync(path.join(__dirname, "..", "src", "app", app.route, "page.tsx")), app.route).toBe(true);
  });
});
