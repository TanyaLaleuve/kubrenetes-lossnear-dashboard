import { AutoRefresh } from "@/components/AutoRefresh";
import { DeploymentList } from "@/components/DeploymentList";
import { PodList } from "@/components/PodList";
import { listAllDeployments, listAllPods } from "@/lib/k8s/resources";
import { isSystemNamespace } from "@/lib/k8s/namespaces";
import { requireView } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Système" };

export default async function SystemPage() {
  await requireView("view.system");
  const [pods, deployments] = await Promise.all([
    listAllPods(),
    listAllDeployments(),
  ]);

  const systemPods = pods.filter((p) => isSystemNamespace(p.metadata?.namespace));
  const systemDeployments = deployments.filter((d) =>
    isSystemNamespace(d.metadata?.namespace),
  );

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <header>
        <h1 className="text-xl font-semibold">Système</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Infrastructure du cluster (Kubernetes, réseau, ingress) —{" "}
          {systemPods.length} pods
        </p>
      </header>

      <PodList pods={systemPods} />

      <section aria-label="Deployments système">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Deployments système
        </h2>
        <DeploymentList deployments={systemDeployments} />
      </section>
    </div>
  );
}
