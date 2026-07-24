import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AdminBackupList } from "@/components/AdminBackupList";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { formatBytes } from "@/lib/k8s/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sauvegardes (admin)" };

export default async function AdminBackupsPage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  const owner = schema.users;
  const rows = await db()
    .select({
      id: schema.backups.id,
      serverId: schema.backups.serverId,
      serverName: schema.backups.serverName,
      ownerName: owner.username,
      kind: schema.backups.kind,
      sizeBytes: schema.backups.sizeBytes,
      createdAt: schema.backups.createdAt,
    })
    .from(schema.backups)
    .leftJoin(owner, eq(owner.id, schema.backups.ownerId))
    .orderBy(desc(schema.backups.createdAt));

  const backups = rows.map((r) => ({
    id: r.id,
    serverName: r.serverName,
    ownerName: r.ownerName,
    kind: r.kind,
    sizeBytes: r.sizeBytes,
    createdAt: r.createdAt,
    orphan: r.serverId === null,
  }));

  const totalBytes = backups.reduce((n, b) => n + b.sizeBytes, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Sauvegardes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {backups.length} sauvegarde{backups.length > 1 ? "s" : ""} ·{" "}
          {formatBytes(totalBytes)} au total. Les sauvegardes « avant
          suppression » ne sont visibles qu&apos;ici.
        </p>
      </header>

      <AdminBackupList backups={backups} />
    </div>
  );
}
