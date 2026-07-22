import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { ChevronRight, UserPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage() {
  const admin = await currentUser();
  if (!admin.isAdmin) redirect("/");

  const users = await db()
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      origin: schema.users.origin,
      isAdmin: schema.users.isAdmin,
      hasAvatar: sql<boolean>`${schema.users.avatar} is not null`,
      serverCount: sql<number>`(
        select count(*)::int from ${schema.servers}
        where ${schema.servers.ownerId} = ${schema.users.id}
      )`,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} compte{users.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
        >
          <UserPlus className="size-4" aria-hidden />
          Nouvel utilisateur
        </Link>
      </header>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {users.map((user) => (
          <li key={user.id}>
            <Link
              href={`/admin/users/${user.id}`}
              className="flex items-center gap-3 p-3.5 transition-colors duration-150 hover:bg-card-hover"
            >
              <Avatar
                userId={user.id}
                username={user.username}
                hasAvatar={user.hasAvatar}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user.username}
                  {user.id === admin.id && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      (toi)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email ?? "pas d'email"} · {user.serverCount} serveur
                  {user.serverCount > 1 ? "s" : ""}
                </p>
              </div>
              <div className="hidden shrink-0 gap-1.5 sm:flex">
                <StatusBadge label={user.origin} tone="muted" />
                {user.isAdmin && <StatusBadge label="admin" tone="ok" />}
              </div>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
