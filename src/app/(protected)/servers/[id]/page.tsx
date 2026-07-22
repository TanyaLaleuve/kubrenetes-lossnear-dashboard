import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  FolderOpen,
  Play,
  RotateCw,
  Settings,
  Skull,
  Square,
  Users,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ServerActionButton } from "@/components/ServerActionButton";
import { ServerAddress } from "@/components/ServerAddress";
import { ServerConsole } from "@/components/ServerConsole";
import { ServerOwner } from "@/components/ServerOwner";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import {
  deleteServer,
  killServer,
  restartServer,
  startServer,
  stopServer,
} from "@/lib/servers/actions";
import { PUBLIC_IP } from "@/lib/servers/constants";
import { SERVERS_NAMESPACE, serverRuntimeStatus } from "@/lib/servers/k8s";
import { podMetrics } from "@/lib/k8s/resources";
import {
  formatAge,
  formatBytes,
  formatCpu,
  parseCpu,
  parseMemory,
} from "@/lib/k8s/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Serveur" };

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const rows = await db()
    .select()
    .from(schema.servers)
    .where(eq(schema.servers.id, id))
    .limit(1);
  const server = rows[0];
  if (!server) notFound();
  if (server.ownerId !== user.id && !user.isAdmin) redirect("/servers");

  const [status, users, ownerRow] = await Promise.all([
    serverRuntimeStatus(server).catch(() => ({
      label: "Error" as const,
      tone: "error" as const,
      pod: undefined,
    })),
    db()
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .orderBy(asc(schema.users.username)),
    db()
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, server.ownerId))
      .limit(1),
  ]);

  const metrics =
    status.label === "Running"
      ? await podMetrics(SERVERS_NAMESPACE).catch(() => [])
      : [];
  const podMetric = metrics.find((m) => m.metadata.name === `${server.slug}-0`);

  const running = server.desiredState === "running";
  // Console active dès que le serveur est censé tourner ou qu'un pod existe
  // (elle affiche les événements de démarrage avant les logs).
  const consoleLive = running || status.pod !== undefined;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/servers"
          aria-label="Retour aux serveurs"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-mono text-lg font-semibold">
            {server.name}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {server.image} · créé {formatAge(server.createdAt)}
          </p>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </header>

      {/* Contrôles d'alimentation : démarrer / arrêter / redémarrer / kill. */}
      <section
        aria-label="Alimentation"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4"
      >
        {!running ? (
          <ServerActionButton
            action={startServer.bind(null, server.id)}
            variant="accent"
          >
            <Play className="size-4" aria-hidden />
            Démarrer
          </ServerActionButton>
        ) : (
          <>
            <ServerActionButton action={stopServer.bind(null, server.id)}>
              <Square className="size-4" aria-hidden />
              Arrêter
            </ServerActionButton>
            <ServerActionButton action={restartServer.bind(null, server.id)}>
              <RotateCw className="size-4" aria-hidden />
              Redémarrer
            </ServerActionButton>
          </>
        )}
        {/* Kill : arrêt dur, visible dès qu'un pod existe (même bloqué). */}
        {status.pod && (
          <ServerActionButton
            action={killServer.bind(null, server.id)}
            variant="destructive"
          >
            <Skull className="size-4" aria-hidden />
            Kill
          </ServerActionButton>
        )}
      </section>

      {/* Gestion : fichiers, permissions, paramètres (à venir), suppression. */}
      <section
        aria-label="Gestion"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4"
      >
        <Link
          href={`/servers/${server.id}/files`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <FolderOpen className="size-4" aria-hidden />
          Fichiers
        </Link>
        <span
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground/50"
          title="Bientôt"
        >
          <Users className="size-4" aria-hidden />
          Permissions
        </span>
        <span
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground/50"
          title="Bientôt"
        >
          <Settings className="size-4" aria-hidden />
          Paramètres
        </span>
        <div className="ml-auto">
          <ConfirmButton
            action={deleteServer.bind(null, server.id)}
            confirmLabel="Supprimer définitivement ?"
          >
            Supprimer
          </ConfirmButton>
        </div>
      </section>

      <ServerConsole serverId={server.id} running={consoleLive} />

      <section
        aria-label="Informations"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <ServerAddress
          serverId={server.id}
          address={server.displayAddress}
          fallback={`${PUBLIC_IP}:${server.hostPort}`}
        />
        <Info label="RAM">
          {podMetric
            ? `${formatBytes(parseMemory(podMetric.containers[0]?.usage.memory ?? "0"))} / ${server.memoryMi} Mio`
            : `${server.memoryMi} Mio alloués`}
        </Info>
        <Info label="CPU">
          {podMetric
            ? `${formatCpu(parseCpu(podMetric.containers[0]?.usage.cpu ?? "0"))} / ${formatCpu(server.cpuMilli / 1000)}`
            : `${formatCpu(server.cpuMilli / 1000)} alloués`}
        </Info>
        <Info label="Disque">{server.diskGi} Gio (persistant)</Info>
      </section>

      <section aria-label="Propriété" className="grid gap-3 sm:grid-cols-2">
        <ServerOwner
          serverId={server.id}
          ownerId={server.ownerId}
          ownerName={ownerRow[0]?.username ?? "?"}
          users={users}
        />
        {Object.keys(server.env).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Variables d&apos;environnement
            </p>
            <dl className="mt-1.5 space-y-1 overflow-x-auto font-mono text-xs">
              {Object.entries(server.env).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="text-accent">{key}=</dt>
                  <dd className="break-all text-muted-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1.5 text-sm">{children}</p>
    </div>
  );
}
