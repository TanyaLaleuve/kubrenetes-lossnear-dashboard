import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { coreApi } from "@/lib/k8s/client";
import { getPodLogs } from "@/lib/k8s/resources";

export const dynamic = "force-dynamic";

export const metadata = { title: "Logs" };

export default async function PodLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ namespace: string; name: string }>;
  searchParams: Promise<{ container?: string }>;
}) {
  const { namespace, name } = await params;
  const { container } = await searchParams;

  const pod = await coreApi().readNamespacedPod({ namespace, name });
  const containers = pod.spec?.containers.map((c) => c.name) ?? [];
  const selected = container ?? containers[0];

  const logs = await getPodLogs(namespace, name, selected).catch(
    (error: unknown) =>
      `Impossible de récupérer les logs : ${error instanceof Error ? error.message : String(error)}`,
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/pods"
          aria-label="Retour aux pods"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-mono text-base font-semibold">{name}</h1>
          <p className="text-xs text-muted-foreground">
            {namespace} · 200 dernières lignes
          </p>
        </div>
        <Link
          href={`/pods/${namespace}/${name}/logs${selected ? `?container=${selected}` : ""}`}
          aria-label="Rafraîchir les logs"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <RotateCw className="size-4" aria-hidden />
        </Link>
      </header>

      {containers.length > 1 && (
        <nav aria-label="Conteneurs" className="flex flex-wrap gap-2">
          {containers.map((c) => (
            <Link
              key={c}
              href={`/pods/${namespace}/${name}/logs?container=${c}`}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-150 ${
                c === selected
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </Link>
          ))}
        </nav>
      )}

      <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {logs || "(aucune sortie)"}
      </pre>
    </div>
  );
}
