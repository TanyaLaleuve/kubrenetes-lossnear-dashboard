import Link from "next/link";
import {
  ArrowLeft,
  FolderOpen,
  Play,
  RotateCw,
  Settings,
  Terminal,
  Skull,
  Square,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ServerActionButton } from "@/components/ServerActionButton";
import { ServerAddress } from "@/components/ServerAddress";
import { ServerConsole } from "@/components/ServerConsole";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";
import {
  killServer,
  restartServer,
  startServer,
  stopServer,
} from "@/lib/servers/actions";
import { serverAccess } from "@/lib/servers/authz";
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

  const access = await serverAccess(user, id);
  if (!access) redirect("/servers");
  const { server, permissions, privileged } = access;
  const can = (perm: string) => permissions.has(perm);
  const canAnyControl =
    can("control.start") ||
    can("control.stop") ||
    can("control.restart") ||
    can("control.kill");
  // Paramètres : visible seulement si quelque chose y est réellement
  // modifiable (members.read seul n'ouvre qu'une vue lecture -> ne compte pas).
  const canModifySettings =
    privileged ||
    can("settings.general") ||
    can("settings.egg") ||
    can("settings.manage") ||
    can("members.manage");
  const canAnyManage = can("files.read") || can("members.read") || canModifySettings;
  // Onglet Paramètres cible : le premier accessible (même ordre que
  // SettingsNav), pour ne pas atterrir sur Général sans la permission.
  const settingsHref = privileged || can("settings.general")
    ? `/servers/${server.shortId}/settings`
    : can("settings.egg")
      ? `/servers/${server.shortId}/settings/startup`
      : `/servers/${server.shortId}/settings/management`;

  const status = await serverRuntimeStatus(server).catch(() => ({
    label: "Error" as const,
    tone: "error" as const,
    pod: undefined,
  }));

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

      {/* Gestion : fichiers, permissions, startup, paramètres. Suppression et
          changement de propriétaire déplacés dans Gestion & Migration. */}
      {canAnyManage && (
        <section
          aria-label="Gestion"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4"
        >
          {can("files.read") && (
            <Link
              href={`/servers/${server.shortId}/files`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
            >
              <FolderOpen className="size-4" aria-hidden />
              Fichiers
            </Link>
          )}
          {can("members.read") && (
            <Link
              href={`/servers/${server.shortId}/members`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
            >
              <Users className="size-4" aria-hidden />
              Permissions
            </Link>
          )}
          {(privileged || can("settings.egg")) && (
            <Link
              href={`/servers/${server.shortId}/settings/startup`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
            >
              <Terminal className="size-4" aria-hidden />
              Startup
            </Link>
          )}
          {canModifySettings && (
            <Link
              href={settingsHref}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
            >
              <Settings className="size-4" aria-hidden />
              Paramètres
            </Link>
          )}
        </section>
      )}

      {/* Contrôles d'alimentation : juste au-dessus de la console. */}
      {canAnyControl && (
        <section
          aria-label="Alimentation"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4"
        >
          {!running
            ? can("control.start") && (
                <ServerActionButton
                  action={startServer.bind(null, server.id)}
                  variant="accent"
                >
                  <Play className="size-4" aria-hidden />
                  Démarrer
                </ServerActionButton>
              )
            : (
                <>
                  {can("control.stop") && (
                    <ServerActionButton action={stopServer.bind(null, server.id)}>
                      <Square className="size-4" aria-hidden />
                      Arrêter
                    </ServerActionButton>
                  )}
                  {can("control.restart") && (
                    <ServerActionButton
                      action={restartServer.bind(null, server.id)}
                    >
                      <RotateCw className="size-4" aria-hidden />
                      Redémarrer
                    </ServerActionButton>
                  )}
                </>
              )}
          {/* Kill : arrêt dur, visible dès qu'un pod existe (même bloqué). */}
          {status.pod && can("control.kill") && (
            <ServerActionButton
              action={killServer.bind(null, server.id)}
              variant="destructive"
            >
              <Skull className="size-4" aria-hidden />
              Kill
            </ServerActionButton>
          )}
        </section>
      )}

      {can("console.read") && (
        <ServerConsole
          serverId={server.id}
          running={consoleLive}
          canCommand={can("console.command")}
        />
      )}

      <section
        aria-label="Informations"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {privileged ? (
          <ServerAddress
            serverId={server.id}
            address={server.displayAddress}
            fallback={`${PUBLIC_IP}:${server.hostPort}`}
          />
        ) : (
          <Info label="Adresse">
            <span className="font-mono">
              {server.displayAddress || `${PUBLIC_IP}:${server.hostPort}`}
            </span>
          </Info>
        )}
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
