import { ExternalLink, Info as InfoIcon } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NodeMetaEditor } from "@/components/NodeMetaEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { listNodes, nodeMetrics } from "@/lib/k8s/resources";
import {
  formatAge,
  formatBytes,
  formatCpu,
  parseCpu,
  parseMemory,
} from "@/lib/k8s/format";
import { requireView } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nœuds" };

const INTERVAL_LABELS: Record<string, string> = {
  hour: "heure",
  month: "mois",
  year: "an",
};

export default async function NodesPage() {
  const user = await requireView("view.nodes");
  const [nodes, metrics, metaRows] = await Promise.all([
    listNodes(),
    nodeMetrics().catch(() => []),
    db().select().from(schema.nodeMeta),
  ]);
  const metaByNode = new Map(metaRows.map((m) => [m.nodeName, m]));

  // Récapitulatif du cluster : capacités cumulées et coût normalisé.
  let totalCpu = 0;
  let totalMemory = 0;
  let totalDisk = 0;
  let monthlyCents = 0;
  let currency = "EUR";
  for (const node of nodes) {
    totalCpu += parseCpu(node.status?.capacity?.cpu ?? "0");
    totalMemory += parseMemory(node.status?.capacity?.memory ?? "0");
    totalDisk += parseMemory(node.status?.capacity?.["ephemeral-storage"] ?? "0");
    const meta = metaByNode.get(node.metadata?.name ?? "");
    if (meta?.priceCents != null) {
      currency = meta.priceCurrency || currency;
      // Normalisation en coût mensuel (heure ≈ 730 h/mois, an = /12).
      const perMonth =
        meta.priceInterval === "hour"
          ? meta.priceCents * 730
          : meta.priceInterval === "year"
            ? meta.priceCents / 12
            : meta.priceCents;
      monthlyCents += perMonth;
    }
  }
  const money = (cents: number) => `${(cents / 100).toFixed(2)} ${currency}`;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <header>
        <h1 className="text-xl font-semibold">Nœuds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {nodes.length} nœud{nodes.length > 1 ? "s" : ""} dans le cluster
        </p>
      </header>

      {/* Récapitulatif cumulé du cluster. */}
      <section
        aria-label="Récapitulatif du cluster"
        className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6"
      >
        <Recap label="Nœuds" value={String(nodes.length)} />
        <Recap label="CPU total" value={`${formatCpu(totalCpu)} cœurs`} />
        <Recap label="RAM totale" value={formatBytes(totalMemory)} />
        <Recap label="Stockage total" value={formatBytes(totalDisk)} />
        <Recap
          label="Coût / mois"
          value={monthlyCents > 0 ? money(monthlyCents) : "—"}
        />
        <Recap
          label="Coût / an"
          value={monthlyCents > 0 ? money(monthlyCents * 12) : "—"}
        />
      </section>

      {user.isAdmin && (
        <details className="rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium">
            <InfoIcon className="size-4 text-accent" aria-hidden />
            Comment ajouter un nœud ?
          </summary>
          <div className="space-y-2 border-t border-border p-4 text-sm text-muted-foreground">
            <p>
              Pas de bouton « automatique » : ajouter un nœud, c&apos;est
              relier une nouvelle machine (VPS) au cluster kubeadm existant.
              Ça se fait en SSH, pas depuis le navigateur.
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Provisionner un nouveau VPS chez ton hébergeur.</li>
              <li>
                Sur ce nœud (control-plane), générer un jeton :{" "}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                  kubeadm token create --print-join-command
                </code>
              </li>
              <li>
                Installer containerd + kubelet + kubeadm sur le nouveau VPS,
                puis exécuter la commande obtenue (
                <code className="font-mono">kubeadm join …</code>) dessus.
              </li>
              <li>
                Il apparaît automatiquement ici une fois rejoint — pas de
                réglage dashboard nécessaire.
              </li>
            </ol>
            <p>
              Une automatisation complète (provisionner le VPS via l&apos;API
              de l&apos;hébergeur + le faire rejoindre tout seul) est possible
              plus tard si besoin, mais nécessite de brancher l&apos;API de
              l&apos;hébergeur choisi — pas fait pour l&apos;instant.
            </p>
          </div>
        </details>
      )}

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
          const storageCapacity = node.status?.capacity?.["ephemeral-storage"];
          const meta = metaByNode.get(name);

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
                {!user.isAdmin && meta?.hostingLabel && (
                  <span className="text-xs text-muted-foreground">
                    · {meta.hostingUrl ? (
                      <a
                        href={meta.hostingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline"
                      >
                        {meta.hostingLabel}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      meta.hostingLabel
                    )}
                  </span>
                )}
                {!user.isAdmin && meta?.priceCents != null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    · {(meta.priceCents / 100).toFixed(2)} {meta.priceCurrency}
                    {meta.priceInterval
                      ? ` / ${INTERVAL_LABELS[meta.priceInterval]}`
                      : ""}
                  </span>
                )}
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
                <Info label="Disque (capacité)">
                  {storageCapacity ? formatBytes(parseMemory(storageCapacity)) : "—"}
                </Info>
                <Info label="Kubelet">{info?.kubeletVersion ?? "—"}</Info>
                <Info label="Runtime">{info?.containerRuntimeVersion ?? "—"}</Info>
                <Info label="OS">{info?.osImage ?? "—"}</Info>
                <Info label="Noyau">{info?.kernelVersion ?? "—"}</Info>
              </dl>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Disque : capacité totale du nœud (pas d&apos;usage en temps
                réel — non exposé par le cluster).
              </p>

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

              {user.isAdmin && (
                <div className="mt-4">
                  <NodeMetaEditor
                    nodeName={name}
                    hostingUrl={meta?.hostingUrl ?? null}
                    hostingLabel={meta?.hostingLabel ?? null}
                    priceCents={meta?.priceCents ?? null}
                    priceCurrency={meta?.priceCurrency ?? "EUR"}
                    priceInterval={meta?.priceInterval ?? null}
                  />
                </div>
              )}
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

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
