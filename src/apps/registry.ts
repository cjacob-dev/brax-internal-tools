import type { Permission } from "@/platform/auth/permissions";

export type AppDefinition = {
  id: string;
  name: string;
  description: string;
  route: string;
  requiredPermission: Permission;
};

/** Every app must be listed here. The sidebar only shows apps the current user can access. */
export const apps: readonly AppDefinition[] = [
  {
    id: "audit",
    name: "Audit log",
    description: "Append-only history of every mutation, access denial, PII reveal, and export.",
    route: "/audit",
    requiredPermission: "audit:read",
  },
];

export function getApp(id: string): AppDefinition {
  const app = apps.find((a) => a.id === id);
  if (!app) throw new Error(`App not registered: ${id}`);
  return app;
}
