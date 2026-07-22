import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AdminPasswordForm } from "@/components/AdminPasswordForm";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusBadge } from "@/components/StatusBadge";
import { UserGrantsForm } from "@/components/UserGrantsForm";
import { UserPermissionsForm } from "@/components/UserPermissionsForm";
import { deleteUser } from "@/lib/admin/actions";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Utilisateur" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await currentUser();
  if (!admin.isAdmin) redirect("/");
  const { id } = await params;

  const rows = await db()
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      origin: schema.users.origin,
      isAdmin: schema.users.isAdmin,
      canCreateServers: schema.users.canCreateServers,
      permissions: schema.users.permissions,
      quotaMaxServers: schema.users.quotaMaxServers,
      quotaMemoryMi: schema.users.quotaMemoryMi,
      quotaCpuMilli: schema.users.quotaCpuMilli,
      quotaDiskGi: schema.users.quotaDiskGi,
      portAllowlist: schema.users.portAllowlist,
      hasAvatar: sql<boolean>`${schema.users.avatar} is not null`,
      serverCount: sql<number>`(
        select count(*)::int from ${schema.servers}
        where ${schema.servers.ownerId} = ${schema.users.id}
      )`,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  const user = rows[0];
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/admin/users"
          aria-label="Retour aux utilisateurs"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <Avatar
          userId={user.id}
          username={user.username}
          hasAvatar={user.hasAvatar}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{user.username}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {user.email ?? "pas d'email"} · {user.serverCount} serveur
            {user.serverCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <StatusBadge label={user.origin} tone="muted" />
          {user.isAdmin && <StatusBadge label="admin" tone="ok" />}
        </div>
      </header>

      {user.id === admin.id ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Ton propre compte : droits gérés en base (protection anti-lockout).
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Droits et quotas</h2>
            <UserGrantsForm user={user} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Sections visibles du dashboard
            </h2>
            <UserPermissionsForm
              userId={user.id}
              permissions={user.permissions}
              isAdmin={user.isAdmin}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Mot de passe</h2>
            <AdminPasswordForm userId={user.id} />
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-destructive">
              Supprimer le compte
            </h2>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Action irréversible. Les invitations de ce compte sur
                d&apos;autres serveurs sont retirées.
                {user.serverCount > 0 && (
                  <>
                    {" "}
                    <span className="font-medium text-destructive">
                      Ses {user.serverCount} serveur
                      {user.serverCount > 1 ? "s" : ""} et leurs données seront
                      aussi définitivement supprimés.
                    </span>
                  </>
                )}
              </p>
              <ConfirmButton
                action={deleteUser.bind(null, user.id)}
                confirmLabel={
                  user.serverCount > 0
                    ? "Oui, supprimer compte + serveurs"
                    : "Oui, supprimer le compte"
                }
              >
                <Trash2 className="size-4 mr-1.5" />
                Supprimer le compte
              </ConfirmButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
