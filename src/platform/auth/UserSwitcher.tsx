"use client";

import { switchUser } from "./actions";

/** Mock SSO only. Removed when real OIDC is wired in (see session.ts). */
export function UserSwitcher({ users, currentUserId }: { users: { id: string; name: string; role: string }[]; currentUserId: string | null }) {
  return (
    <form action={switchUser} className="flex items-center gap-2 text-sm">
      <label htmlFor="user-switcher" className="text-zinc-500">
        Signed in as
      </label>
      <select
        id="user-switcher"
        name="userId"
        defaultValue={currentUserId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1"
      >
        <option value="" disabled>
          Choose a demo user...
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.role})
          </option>
        ))}
      </select>
    </form>
  );
}
