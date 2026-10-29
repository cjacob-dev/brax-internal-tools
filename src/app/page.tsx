import { getCurrentActor } from "@/platform/auth/actor";
import { ROLE_PERMISSIONS, isKnownRole } from "@/platform/auth/permissions";
import { Card, PageHeader } from "@/platform/ui";

export default async function HomePage() {
  const actor = await getCurrentActor();
  if (!actor) {
    return (
      <>
        <PageHeader title="Welcome" description="Internal tools for Brax operations and compliance." />
        <Card>
          <p className="text-sm text-zinc-600">Choose a demo user from the switcher in the header. All users are fictional.</p>
        </Card>
      </>
    );
  }
  const permissions = isKnownRole(actor.role) ? ROLE_PERMISSIONS[actor.role] : [];
  return (
    <>
      <PageHeader title={`Hi, ${actor.name}`} description="Apps you can access are in the sidebar." />
      <Card>
        <p className="text-sm text-zinc-600">
          Role: <span className="font-mono">{actor.role}</span>
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Permissions: <span className="font-mono">{permissions.length ? permissions.join(", ") : "none"}</span>
        </p>
      </Card>
    </>
  );
}
