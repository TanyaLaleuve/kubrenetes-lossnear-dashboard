import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PodList } from "@/components/PodList";
import { listAllPods } from "@/lib/k8s/resources";
import { isSystemNamespace } from "@/lib/k8s/namespaces";
import { requireView } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pods" };

export default async function PodsPage() {
  await requireView("view.pods");
  const pods = await listAllPods();
  const appPods = pods.filter((p) => !isSystemNamespace(p.metadata?.namespace));
  const systemCount = pods.length - appPods.length;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <header>
        <h1 className="text-xl font-semibold">Pods</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {appPods.length} pods applicatifs ·{" "}
          <Link href="/system" className="underline hover:text-foreground">
            {systemCount} pods système
          </Link>
        </p>
      </header>

      <PodList pods={appPods} />
    </div>
  );
}
