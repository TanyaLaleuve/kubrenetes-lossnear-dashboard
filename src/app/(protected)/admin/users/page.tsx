import { asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { UserGrantsForm } from "@/components/UserGrantsForm";
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
      canCreateServers: schema.users.canCreateServers,
      quotaMaxServers: schema.users.quotaMaxServers,
      quotaMemoryMi: schema.users.quotaMemoryMi,
      quotaCpuMilli: schema.users.quotaCpuMilli,
      quotaDiskGi: schema.users.quotaDiskGi,
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
      <header>
        <h1 className="text-xl font-semibold">Utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {users.length} compte{users.length > 1 ? "s" : ""} — droits de création
          et quotas de serveurs
        </p>
      </header>

      <ul className="space-y-3">
        {users.map((user) => (
          <li
            key={user.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Avatar
                userId={user.id}
                username={user.username}
                hasAvatar={user.hasAvatar}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-semibold">
                  {user.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email ?? "pas d'email"} · {user.serverCount} serveur
                  {user.serverCount > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <StatusBadge label={user.origin} tone="muted" />
                {user.isAdmin && <StatusBadge label="admin" tone="ok" />}
              </div>
            </div>
            {user.id !== admin.id ? (
              <div className="mt-4">
                <UserGrantsForm user={user} />
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Ton propre compte : droits gérés en base (protection anti-lockout).
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
