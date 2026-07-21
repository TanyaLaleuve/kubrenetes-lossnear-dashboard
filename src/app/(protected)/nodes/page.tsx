import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { listNodes, nodeMetrics } from "@/lib/k8s/resources";
import {
  formatAge,
  formatBytes,
  formatCpu,
  parseCpu,
  parseMemory,
} from "@/lib/k8s/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nœuds" };

export default async function NodesPage() {
  const [nodes, metrics] = await Promise.all([
    listNodes(),
    nodeMetrics().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <header>
        <h1 className="text-xl font-semibold">Nœuds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {nodes.length} nœud{nodes.length > 1 ? "s" : ""} dans le cluster
        </p>
      </header>

      <div className="space-y-4">
        {nodes.map((node) => {
          const name = node.metadata?.name ?? "?";
          const ready = node.status?.conditions?.find((c) => c.type === "Ready");
          const isReady = ready?.status === "True";
          const roles = Object.keys(node.metadata?.labels ?? {})
            .filter((l) => l.startsWith("node-role.kubernetes.io/"))
            .map((l) => l.replace("node-role.kubernetes.io/", ""))
            .join(", ");
          const metric = metrics.find((m) => m.metadata.name === name);
          const info = node.status?.nodeInfo;
          return (
            <article
              key={node.metadata?.uid}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-mono text-sm font-semibold">{name}</h2>
                <StatusBadge
                  label={isReady ? "Ready" : "NotReady"}
                  tone={isReady ? "ok" : "error"}
                />
                <span className="text-xs text-muted-foreground">
                  {roles || "worker"} · {formatAge(node.metadata?.creationTimestamp)}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                <Info label="CPU (capacité)">
                  {formatCpu(parseCpu(node.status?.capacity?.cpu ?? "0"))}
                </Info>
                <Info label="Mémoire (capacité)">
                  {formatBytes(parseMemory(node.status?.capacity?.memory ?? "0"))}
                </Info>
                <Info label="CPU (usage)">
                  {metric ? formatCpu(parseCpu(metric.usage.cpu)) : "—"}
                </Info>
                <Info label="Mémoire (usage)">
                  {metric ? formatBytes(parseMemory(metric.usage.memory)) : "—"}
                </Info>
                <Info label="Kubelet">{info?.kubeletVersion ?? "—"}</Info>
                <Info label="Runtime">{info?.containerRuntimeVersion ?? "—"}</Info>
                <Info label="OS">{info?.osImage ?? "—"}</Info>
                <Info label="Noyau">{info?.kernelVersion ?? "—"}</Info>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {node.status?.conditions
                  ?.filter((c) => c.type !== "Ready")
                  .map((condition) => (
                    <StatusBadge
                      key={condition.type}
                      label={condition.type}
                      tone={condition.status === "False" ? "muted" : "error"}
                    />
                  ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-sm">{children}</dd>
    </div>
  );
}
