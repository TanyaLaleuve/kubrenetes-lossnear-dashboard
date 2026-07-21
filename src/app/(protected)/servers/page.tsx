import Link from "next/link";
import { eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverRuntimeStatus } from "@/lib/servers/k8s";
import { formatAge } from "@/lib/k8s/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Serveurs" };

export default async function ServersPage() {
  const user = await currentUser();

  const rows = await db()
    .select()
    .from(schema.servers)
    .where(user.isAdmin ? undefined : eq(schema.servers.ownerId, user.id));

  const withStatus = await Promise.all(
    rows.map(async (server) => ({
      server,
      status: await serverRuntimeStatus(server).catch(() => ({
        label: "Error" as const,
        tone: "error" as const,
      })),
    })),
  );

  const canCreate = user.canCreateServers || user.isAdmin;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Serveurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} serveur{rows.length > 1 ? "s" : ""}
            {user.isAdmin ? " (vue admin : tous)" : ""}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/servers/new"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Nouveau serveur
          </Link>
        )}
      </header>

      {withStatus.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {canCreate
            ? "Aucun serveur. Crée le premier avec « Nouveau serveur »."
            : "Aucun serveur. Demande à un admin le droit de création."}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {withStatus.map(({ server, status }) => (
          <li key={server.id}>
            <Link
              href={`/servers/${server.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-card-hover"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm font-semibold">
                  {server.name}
                </p>
                <StatusBadge label={status.label} tone={status.tone} />
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {server.image}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                port {server.hostPort} · {server.memoryMi} Mio ·{" "}
                {server.cpuMilli}m CPU · {server.diskGi} Gio ·{" "}
                {formatAge(server.createdAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
