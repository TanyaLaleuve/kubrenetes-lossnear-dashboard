import { RotateCw } from "lucide-react";
import type { V1Deployment } from "@kubernetes/client-node";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ScaleControl } from "@/components/ScaleControl";
import { StatusBadge } from "@/components/StatusBadge";
import { restartDeploymentAction } from "@/lib/k8s/actions";
import { formatAge } from "@/lib/k8s/format";

export function DeploymentList({ deployments }: { deployments: V1Deployment[] }) {
  if (deployments.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Aucun deployment.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {deployments
          .sort((a, b) =>
            `${a.metadata?.namespace}/${a.metadata?.name}`.localeCompare(
              `${b.metadata?.namespace}/${b.metadata?.name}`,
            ),
          )
          .map((deployment) => {
            const namespace = deployment.metadata?.namespace ?? "?";
            const name = deployment.metadata?.name ?? "?";
            const desired = deployment.spec?.replicas ?? 0;
            const ready = deployment.status?.readyReplicas ?? 0;
            const tone =
              desired === 0 ? "muted" : ready === desired ? "ok" : "pending";
            return (
              <li
                key={deployment.metadata?.uid}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3"
              >
                <div className="min-w-0 flex-1 basis-52">
                  <p className="truncate font-mono text-sm">{name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {namespace} ·{" "}
                    {formatAge(deployment.metadata?.creationTimestamp)}
                  </p>
                </div>
                <StatusBadge label={`${ready}/${desired}`} tone={tone} />
                <div className="flex items-center gap-2">
                  <ScaleControl
                    namespace={namespace}
                    name={name}
                    replicas={desired}
                  />
                  <ConfirmButton
                    action={restartDeploymentAction.bind(null, namespace, name)}
                    confirmLabel="Redémarrer ?"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <RotateCw className="size-3.5" aria-hidden />
                      Restart
                    </span>
                  </ConfirmButton>
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
