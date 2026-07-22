import Link from "next/link";
import { Activity, Boxes, Server, SquareStack } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  listAllDeployments,
  listAllPods,
  listNodes,
  nodeMetrics,
  recentEvents,
} from "@/lib/k8s/resources";
import { isSystemNamespace } from "@/lib/k8s/namespaces";
import {
  formatAge,
  formatBytes,
  formatCpu,
  parseCpu,
  parseMemory,
  podStatus,
} from "@/lib/k8s/format";
import { requireView } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireView("view.overview");
  const [nodes, pods, deployments, metrics, events] = await Promise.all([
    listNodes(),
    listAllPods(),
    listAllDeployments(),
    nodeMetrics().catch(() => []),
    recentEvents(10).catch(() => []),
  ]);

  // La vue d'ensemble met en avant les applications lossnear ;
  // l'infrastructure vit sur la page /system.
  const appPods = pods.filter((p) => !isSystemNamespace(p.metadata?.namespace));
  const appDeployments = deployments.filter(
    (d) => !isSystemNamespace(d.metadata?.namespace),
  );
  const runningPods = appPods.filter((p) => podStatus(p).tone === "ok").length;
  const problemPods = appPods.filter((p) => podStatus(p).tone === "error").length;
  const systemProblemPods = pods.filter(
    (p) =>
      isSystemNamespace(p.metadata?.namespace) && podStatus(p).tone === "error",
  ).length;
  const readyNodes = nodes.filter((n) =>
    n.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True"),
  ).length;
  const readyDeployments = appDeployments.filter(
    (d) => (d.status?.readyReplicas ?? 0) === (d.spec?.replicas ?? 0),
  ).length;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <header>
        <h1 className="text-xl font-semibold">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          État du cluster en temps réel
        </p>
      </header>

      <section
        aria-label="Statistiques du cluster"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Link href="/nodes">
          <StatCard
            label="Nœuds"
            value={`${readyNodes}/${nodes.length}`}
            detail="prêts"
            icon={<Server className="size-4" aria-hidden />}
          />
        </Link>
        <Link href="/pods">
          <StatCard
            label="Pods apps"
            value={`${runningPods}/${appPods.length}`}
            detail={problemPods > 0 ? `${problemPods} en erreur` : "tous sains"}
            icon={<Boxes className="size-4" aria-hidden />}
          />
        </Link>
        <Link href="/workloads">
          <StatCard
            label="Deployments apps"
            value={`${readyDeployments}/${appDeployments.length}`}
            detail="prêts"
            icon={<SquareStack className="size-4" aria-hidden />}
          />
        </Link>
        <Link href="/system">
          <StatCard
            label="Système"
            value={systemProblemPods > 0 ? `${systemProblemPods} err.` : "OK"}
            detail={
              systemProblemPods > 0
                ? "pods système en erreur"
                : "infrastructure saine"
            }
            icon={<Activity className="size-4" aria-hidden />}
          />
        </Link>
      </section>

      <section aria-label="Ressources par nœud" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Ressources par nœud
        </h2>
        {nodes.map((node) => {
          const name = node.metadata?.name ?? "?";
          const metric = metrics.find((m) => m.metadata.name === name);
          const cpuUsed = metric ? parseCpu(metric.usage.cpu) : null;
          const memUsed = metric ? parseMemory(metric.usage.memory) : null;
          const cpuCap = parseCpu(node.status?.capacity?.cpu ?? "0");
          const memCap = parseMemory(node.status?.capacity?.memory ?? "0");
          return (
            <div
              key={name}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">
                  k8s {node.status?.nodeInfo?.kubeletVersion}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ResourceGauge
                  label="CPU"
                  used={cpuUsed}
                  capacity={cpuCap}
                  format={formatCpu}
                />
                <ResourceGauge
                  label="Mémoire"
                  used={memUsed}
                  capacity={memCap}
                  format={formatBytes}
                />
              </div>
            </div>
          );
        })}
      </section>

      <section aria-label="Événements récents" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Événements récents
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {events.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Aucun événement.</p>
          )}
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <li key={event.metadata.uid} className="flex items-start gap-3 p-3">
                <StatusBadge
                  label={event.type ?? "?"}
                  tone={event.type === "Warning" ? "error" : "muted"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{event.message}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {event.involvedObject.namespace ?? "—"}/
                    {event.involvedObject.name} ·{" "}
                    {formatAge(event.lastTimestamp ?? event.eventTime)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ResourceGauge({
  label,
  used,
  capacity,
  format,
}: {
  label: string;
  used: number | null;
  capacity: number;
  format: (n: number) => string;
}) {
  const percent =
    used !== null && capacity > 0 ? Math.min(100, (used / capacity) * 100) : null;
  const barColor =
    percent === null
      ? "bg-muted"
      : percent > 85
        ? "bg-destructive"
        : percent > 65
          ? "bg-warning"
          : "bg-accent";
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {used !== null ? `${format(used)} / ${format(capacity)}` : "métriques indisponibles"}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Utilisation ${label}`}
        aria-valuenow={percent !== null ? Math.round(percent) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {percent !== null && (
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
