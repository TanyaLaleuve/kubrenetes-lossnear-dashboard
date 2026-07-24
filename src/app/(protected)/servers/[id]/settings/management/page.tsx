import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ServerManagementForm } from "@/components/ServerManagementForm";
import { currentUser } from "@/lib/auth/user";
import { canOpenNetwork } from "@/lib/auth/dashboard-permissions";
import { db, schema } from "@/lib/db";
import { listNodes } from "@/lib/k8s/resources";
import { serverAccess } from "@/lib/servers/authz";
import { ownerAllocatedBackups } from "@/lib/servers/backups";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gestion & Migration" };

export default async function ServerSettingsManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  const canManage =
    !!access && (access.privileged || access.permissions.has("settings.manage"));
  if (!access || !canManage) redirect(`/servers/${id}`);
  const { server } = access;

  const nodesList = await listNodes().catch(() => []);
  const nodes = nodesList.map((n) => ({
    name: n.metadata?.name ?? "Inconnu",
    ready:
      n.status?.conditions?.some(
        (c) => c.type === "Ready" && c.status === "True",
      ) ?? false,
  }));

  // Infos de sauvegarde du propriétaire (droit + reste attribuable).
  const [owner] = await db()
    .select({
      isAdmin: schema.users.isAdmin,
      canBackup: schema.users.canBackup,
      backupQuota: schema.users.backupQuota,
    })
    .from(schema.users)
    .where(eq(schema.users.id, server.ownerId))
    .limit(1);
  const backupsEnabled = !!owner && (owner.isAdmin || owner.canBackup);
  const allocatedElsewhere = await ownerAllocatedBackups(server.ownerId, server.id);
  const quota = owner?.isAdmin ? 1000 : owner?.backupQuota ?? 0;
  const backupRemaining = Math.max(0, quota - allocatedElsewhere);

  return (
    <div className="space-y-6">
      <ServerManagementForm
        server={server}
        nodes={nodes}
        canManage={canManage}
        isPrivileged={access.privileged}
        canOpenNetwork={canOpenNetwork(user)}
        backupsEnabled={backupsEnabled}
        backupRemaining={backupRemaining}
      />
    </div>
  );
}
