import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { apps } from "@/apps/registry";
import { getCurrentActor, hasPermission } from "@/platform/auth/actor";
import { listSwitchableUsers } from "@/platform/auth/demo-users";
import { UserSwitcher } from "@/platform/auth/UserSwitcher";

export const metadata: Metadata = { title: "Brax Internal Tools" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [actor, users] = await Promise.all([getCurrentActor(), listSwitchableUsers()]);
  const visibleApps = apps.filter((app) => hasPermission(actor, app.requiredPermission));
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <Link href="/" className="text-base font-semibold tracking-tight text-zinc-900">
            Brax Internal Tools
          </Link>
          <UserSwitcher users={users} currentUserId={actor?.id ?? null} />
        </header>
        <div className="flex">
          <nav aria-label="Apps" className="min-h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-zinc-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Apps</p>
            {visibleApps.length === 0 ? (
              <p className="text-sm text-zinc-500">{actor ? "No apps for your role yet." : "Choose a user to begin."}</p>
            ) : (
              <ul className="space-y-1">
                {visibleApps.map((app) => (
                  <li key={app.id}>
                    <Link href={app.route} className="block rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">
                      {app.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>
          <main className="min-w-0 flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
