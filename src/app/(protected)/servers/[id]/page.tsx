import { Play, RotateCw, Skull, Square } from "lucide-react";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ServerActionButton } from "@/components/ServerActionButton";
import { ServerAddress } from "@/components/ServerAddress";
import { ServerConsole } from "@/components/ServerConsole";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";
import {
  killServer,
  restartServer,
  startServer,
  stopServer,
} from "@/lib/servers/actions";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";
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
      <ServerHeader
        name={server.name}
        subtitle={`${server.image} · créé ${formatAge(server.createdAt)}`}
      >
        <StatusBadge label={status.label} tone={status.tone} />
      </ServerHeader>

      <ServerNav {...serverNavProps(access)} />

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
