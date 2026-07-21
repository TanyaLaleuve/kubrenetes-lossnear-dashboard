import Link from "next/link";
import { FileText } from "lucide-react";
import type { V1Pod } from "@kubernetes/client-node";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusBadge } from "@/components/StatusBadge";
import { deletePodAction } from "@/lib/k8s/actions";
import { formatAge, podStatus } from "@/lib/k8s/format";

export function PodList({ pods }: { pods: V1Pod[] }) {
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
                  return (
                    <li
                      key={pod.metadata?.uid}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
                    >
                      <div className="min-w-0 flex-1 basis-52">
                        <p className="truncate font-mono text-sm">{name}</p>
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
                        <ConfirmButton
                          action={deletePodAction.bind(null, namespace, name)}
                        >
                          Supprimer
                        </ConfirmButton>
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
