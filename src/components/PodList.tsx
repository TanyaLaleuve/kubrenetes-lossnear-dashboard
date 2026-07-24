import Link from "next/link";
import { FileText, Skull } from "lucide-react";
import type { V1Pod } from "@kubernetes/client-node";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusBadge } from "@/components/StatusBadge";
import { deletePodAction } from "@/lib/k8s/actions";
import { killServer } from "@/lib/servers/actions";
import { formatAge, podStatus } from "@/lib/k8s/format";

/** Accès d'un utilisateur au serveur d'un pod (page pods). */
export type ServerPodInfo = {
  serverId: string;
  shortId: string;
  /** Permission control.kill : proposer Kill au lieu de supprimer le pod. */
  canKill: boolean;
};

export function PodList({
  pods,
  serverInfo = {},
}: {
  pods: V1Pod[];
  serverInfo?: Record<string, ServerPodInfo>;
}) {
  const byNamespace = new Map<string, V1Pod[]>();
  for (const pod of pods) {
    const ns = pod.metadata?.namespace ?? "?";
    byNamespace.set(ns, [...(byNamespace.get(ns) ?? []), pod]);
  }

  if (pods.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Aucun pod.
      </p>
    );
  }

  return (
    <>
      {[...byNamespace.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([namespace, nsPods]) => (
          <section key={namespace} aria-label={`Namespace ${namespace}`}>
            <h2 className="mb-2 font-mono text-sm font-semibold text-muted-foreground">
              {namespace}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {nsPods.map((pod) => {
                  const name = pod.metadata?.name ?? "?";
                  const status = podStatus(pod);
                  const server = pod.metadata?.uid
                    ? serverInfo[pod.metadata.uid]
                    : undefined;
                  return (
                    <li
                      key={pod.metadata?.uid}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
                    >
                      <div className="min-w-0 flex-1 basis-52">
                        {/* Pod de serveur accessible : le nom mène à sa page. */}
                        {server ? (
                          <Link
                            href={`/servers/${server.shortId}`}
                            className="truncate font-mono text-sm text-accent hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          <p className="truncate font-mono text-sm">{name}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          prêt {status.ready} · {status.restarts} redémarrages ·{" "}
                          {formatAge(pod.metadata?.creationTimestamp)}
                        </p>
                      </div>
                      <StatusBadge label={status.label} tone={status.tone} />
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/pods/${namespace}/${name}/logs`}
                          aria-label={`Logs de ${name}`}
                          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
                        >
                          <FileText className="size-3.5" aria-hidden />
                        </Link>
                        {server ? (
                          // Pod de serveur : « supprimer » = Kill (sinon le
                          // StatefulSet recrée aussitôt le pod). Réservé à qui a
                          // la permission control.kill.
                          server.canKill && (
                            <ConfirmButton
                              action={killServer.bind(null, server.serverId)}
                              confirmLabel="Confirmer le kill"
                            >
                              <Skull className="mr-1 size-3.5" aria-hidden />
                              Kill
                            </ConfirmButton>
                          )
                        ) : (
                          <ConfirmButton
                            action={deletePodAction.bind(null, namespace, name)}
                          >
                            Supprimer
                          </ConfirmButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}
    </>
  );
}
