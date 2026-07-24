import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PodList, type ServerPodInfo } from "@/components/PodList";
import { listAllPods } from "@/lib/k8s/resources";
import { isSystemNamespace } from "@/lib/k8s/namespaces";
import { requireView } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pods" };

export default async function PodsPage() {
  const user = await requireView("view.pods");
  const pods = await listAllPods();
  const appPods = pods.filter((p) => !isSystemNamespace(p.metadata?.namespace));
  const systemCount = pods.length - appPods.length;

  // Pods de serveurs : on résout l'accès de l'utilisateur pour les rendre
  // cliquables (page serveur) et proposer Kill au lieu de « supprimer le pod ».
  const serverInfo: Record<string, ServerPodInfo> = {};
  for (const pod of appPods) {
    const serverId = pod.metadata?.labels?.["lossnear.com/server-id"];
    const uid = pod.metadata?.uid;
    if (!serverId || !uid) continue;
    const access = await serverAccess(user, serverId).catch(() => null);
    if (!access) continue;
    serverInfo[uid] = {
      serverId: access.server.id,
      shortId: access.server.shortId,
      canKill: access.permissions.has("control.kill"),
    };
  }

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

      <PodList pods={appPods} serverInfo={serverInfo} />
    </div>
  );
}
