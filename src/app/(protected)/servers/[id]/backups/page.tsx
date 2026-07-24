import { redirect } from "next/navigation";
import { BackupManager } from "@/components/BackupManager";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";
import { listServerBackups } from "@/lib/servers/backup-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sauvegardes" };

export default async function ServerBackupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access || !access.permissions.has("backups.read")) {
    redirect(`/servers/${id}`);
  }
  const { server, permissions } = access;

  // Le droit de sauvegarder vient du compte propriétaire (pas du membre agissant).
  const [owner] = await db()
    .select({ isAdmin: schema.users.isAdmin, canBackup: schema.users.canBackup })
    .from(schema.users)
    .where(eq(schema.users.id, server.ownerId))
    .limit(1);
  const ownerCanBackup = !!owner && (owner.isAdmin || owner.canBackup);

  const backups = await listServerBackups(id);

  return (
    <div className="space-y-6">
      <ServerHeader name={server.name} subtitle="Sauvegardes du serveur" />

      <ServerNav {...serverNavProps(access)} />

      {!ownerCanBackup ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Les sauvegardes ne sont pas activées pour le propriétaire de ce
          serveur. Un administrateur peut les activer sur son compte.
        </p>
      ) : (
        <BackupManager
          serverId={server.id}
          backups={backups}
          limit={server.backupLimit}
          used={backups.length}
          canCreate={permissions.has("backups.create")}
          canRestore={permissions.has("backups.restore")}
          canDelete={permissions.has("backups.delete")}
        />
      )}
    </div>
  );
}
