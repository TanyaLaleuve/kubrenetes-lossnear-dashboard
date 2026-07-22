import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { listAllPods, listNamespaces } from "@/lib/k8s/resources";
import { formatAge } from "@/lib/k8s/format";
import { requireView } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Namespaces" };

export default async function NamespacesPage() {
  await requireView("view.namespaces");
  const [namespaces, pods] = await Promise.all([listNamespaces(), listAllPods()]);

  const podCount = new Map<string, number>();
  for (const pod of pods) {
    const ns = pod.metadata?.namespace ?? "?";
    podCount.set(ns, (podCount.get(ns) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <header>
        <h1 className="text-xl font-semibold">Namespaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {namespaces.length} namespaces
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {namespaces.map((namespace) => {
            const name = namespace.metadata?.name ?? "?";
            const active = namespace.status?.phase === "Active";
            return (
              <li
                key={namespace.metadata?.uid}
                className="flex items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {podCount.get(name) ?? 0} pods ·{" "}
                    {formatAge(namespace.metadata?.creationTimestamp)}
                  </p>
                </div>
                <StatusBadge
                  label={namespace.status?.phase ?? "?"}
                  tone={active ? "ok" : "error"}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
