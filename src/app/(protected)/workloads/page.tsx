import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DeploymentList } from "@/components/DeploymentList";
import { listAllDeployments } from "@/lib/k8s/resources";
import { isSystemNamespace } from "@/lib/k8s/namespaces";
import { requireView } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Workloads" };

export default async function WorkloadsPage() {
  await requireView("view.workloads");
  const deployments = await listAllDeployments();
  const appDeployments = deployments.filter(
    (d) => !isSystemNamespace(d.metadata?.namespace),
  );
  const systemCount = deployments.length - appDeployments.length;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <header>
        <h1 className="text-xl font-semibold">Workloads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {appDeployments.length} deployments applicatifs ·{" "}
          <Link href="/system" className="underline hover:text-foreground">
            {systemCount} système
          </Link>
        </p>
      </header>

      <DeploymentList deployments={appDeployments} />
    </div>
  );
}
