import Link from "next/link";
import { eq, inArray, or } from "drizzle-orm";
import { Plus } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverRuntimeStatus } from "@/lib/servers/k8s";
import { formatAge } from "@/lib/k8s/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Serveurs" };

const SORTS = [
  { key: "name", label: "Nom" },
  { key: "created", label: "Récents" },
  { key: "status", label: "Statut" },
] as const;

const STATUS_ORDER = { Running: 0, Starting: 1, Stopping: 2, Error: 3, Stopped: 4 };

export default async function ServersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const user = await currentUser();
  const { sort: sortParam } = await searchParams;
  const sort = SORTS.some((s) => s.key === sortParam) ? sortParam : "name";

  // Serveurs visibles : les siens + ceux où l'on est invité (admin : tous).
  let filter;
  if (!user.isAdmin) {
    const memberships = await db()
      .select({ serverId: schema.serverMembers.serverId })
      .from(schema.serverMembers)
      .where(eq(schema.serverMembers.userId, user.id));
    const memberIds = memberships.map((m) => m.serverId);
    filter = memberIds.length
      ? or(
          eq(schema.servers.ownerId, user.id),
          inArray(schema.servers.id, memberIds),
        )
      : eq(schema.servers.ownerId, user.id);
  }

  const rows = await db().select().from(schema.servers).where(filter);

  const withStatus = await Promise.all(
    rows.map(async (server) => ({
      server,
      status: await serverRuntimeStatus(server).catch(() => ({
        label: "Error" as const,
        tone: "error" as const,
      })),
    })),
  );

  withStatus.sort((a, b) => {
    if (sort === "created") {
      return b.server.createdAt.valueOf() - a.server.createdAt.valueOf();
    }
    if (sort === "status") {
      const diff =
        STATUS_ORDER[a.status.label] - STATUS_ORDER[b.status.label];
      if (diff !== 0) return diff;
    }
    return a.server.name.localeCompare(b.server.name, "fr", {
      sensitivity: "base",
    });
  });

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

      {withStatus.length > 1 && (
        <nav aria-label="Tri" className="flex gap-2">
          {SORTS.map(({ key, label }) => (
            <Link
              key={key}
              href={`/servers?sort=${key}`}
              className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${
                sort === key
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

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
