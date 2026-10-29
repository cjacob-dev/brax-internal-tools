export const PERMISSIONS = [
  "kyc:read",
  "kyc:recommend",
  "kyc:decide",
  "kyc:reveal_pii",
  "audit:read",
  "audit:export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["ops_analyst", "compliance_reviewer", "admin"] as const;

export type Role = (typeof ROLES)[number];

/**
 * The one central role -> permission map. Anything not listed is denied.
 * Admin deliberately has no kyc:* grants (separation of duties).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ops_analyst: ["kyc:read", "kyc:recommend"],
  compliance_reviewer: ["kyc:read", "kyc:decide", "kyc:reveal_pii"],
  admin: ["audit:read", "audit:export"],
};

export function isKnownPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isKnownRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleHasPermission(role: string, permission: string): boolean {
  return isKnownRole(role) && isKnownPermission(permission) && ROLE_PERMISSIONS[role].includes(permission);
}
