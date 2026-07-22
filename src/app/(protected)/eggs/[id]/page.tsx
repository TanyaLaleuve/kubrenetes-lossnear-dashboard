import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Rocket } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { EggDeleteButton } from "@/components/EggDeleteButton";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Template" };

export default async function EggDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");
  const { id } = await params;

  const [egg] = await db()
    .select()
    .from(schema.eggs)
    .where(eq(schema.eggs.id, id))
    .limit(1);
  if (!egg) notFound();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/eggs"
          aria-label="Retour aux templates"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{egg.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {egg.author ? `par ${egg.author} · ` : ""}
            {egg.source === "imported" ? "importé" : "maison"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/servers/new?egg=${egg.id}`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Rocket className="size-4" aria-hidden />
            Créer un serveur
          </Link>
          <Link
            href={`/eggs/${egg.id}/edit`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden />
            Modifier
          </Link>
          <EggDeleteButton eggId={egg.id} eggName={egg.name} />
        </div>
      </header>

      {egg.description && (
        <p className="text-sm text-muted-foreground">{egg.description}</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Images Docker
        </h2>
        <ul className="space-y-1.5">
          {Object.entries(egg.dockerImages).map(([label, image]) => (
            <li
              key={image}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="text-sm">{label}</span>
              <code className="font-mono text-xs text-muted-foreground">
                {image}
              </code>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Démarrage
        </h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-[#04070f] p-3 font-mono text-xs">
          {egg.startup || "—"}
        </pre>
        {egg.stopCommand && (
          <p className="text-xs text-muted-foreground">
            Arrêt : <code className="font-mono">{egg.stopCommand}</code>
          </p>
        )}
      </section>

      {egg.installScript && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Script d&apos;installation
          </h2>
          <p className="text-xs text-muted-foreground">
            Image : <code className="font-mono">{egg.installContainer}</code> ·
            entrypoint : <code className="font-mono">{egg.installEntrypoint}</code>
          </p>
          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-[#04070f] p-3 font-mono text-xs">
            {egg.installScript}
          </pre>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Variables ({egg.variables.length})
        </h2>
        {egg.variables.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune variable.</p>
        ) : (
          <ul className="space-y-2">
            {egg.variables.map((v) => (
              <li
                key={v.envVariable}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {v.name || v.envVariable}
                  </span>
                  <code className="font-mono text-xs text-accent">
                    {v.envVariable}
                  </code>
                  {!v.userEditable && (
                    <span className="text-[10px] text-muted-foreground">
                      non modifiable
                    </span>
                  )}
                  {!v.userViewable && (
                    <span className="text-[10px] text-muted-foreground">
                      caché
                    </span>
                  )}
                </div>
                {v.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.description}
                  </p>
                )}
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  défaut : {v.defaultValue || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
