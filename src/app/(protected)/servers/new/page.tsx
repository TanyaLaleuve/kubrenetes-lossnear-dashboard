import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, Boxes, Egg as EggIcon, Rocket } from "lucide-react";
import { redirect } from "next/navigation";
import { ServerCreateForm } from "@/components/ServerCreateForm";
import { EggServerForm } from "@/components/EggServerForm";
import { requireView } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau serveur" };

export default async function NewServerPage({
  searchParams,
}: {
  searchParams: Promise<{ egg?: string; mode?: string }>;
}) {
  const user = await requireView("view.servers");
  if (!user.canCreateServers && !user.isAdmin) {
    redirect("/servers");
  }
  const { egg: eggId, mode } = await searchParams;

  // Les admins ne sont pas limités par les quotas.
  const cap = user.isAdmin
    ? { maxMemoryMi: 32768, maxCpuMilli: 16000, maxDiskGi: 200 }
    : {
        maxMemoryMi: user.quotaMemoryMi,
        maxCpuMilli: user.quotaCpuMilli,
        maxDiskGi: user.quotaDiskGi,
      };

  function Header({ subtitle, back }: { subtitle: string; back: string }) {
    return (
      <header className="flex items-center gap-3">
        <Link
          href={back}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Nouveau serveur</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </header>
    );
  }

  // --- Création depuis un egg ---
  if (eggId) {
    const [egg] = await db()
      .select()
      .from(schema.eggs)
      .where(eq(schema.eggs.id, eggId))
      .limit(1);
    if (!egg) redirect("/servers/new");

    return (
      <div className="space-y-6">
        <Header subtitle={`Template : ${egg.name}`} back="/servers/new" />
        <div className="rounded-xl border border-border bg-card p-5">
          <EggServerForm
            egg={{
              id: egg.id,
              dockerImages: egg.dockerImages,
              variables: egg.variables,
            }}
            {...cap}
          />
        </div>
      </div>
    );
  }

  // --- Création image libre ---
  if (mode === "custom") {
    return (
      <div className="space-y-6">
        <Header
          subtitle="Image Docker libre · port attribué automatiquement"
          back="/servers/new"
        />
        <div className="rounded-xl border border-border bg-card p-5">
          <ServerCreateForm {...cap} />
        </div>
      </div>
    );
  }

  // --- Choix de la méthode ---
  const eggs = await db()
    .select({
      id: schema.eggs.id,
      name: schema.eggs.name,
      description: schema.eggs.description,
    })
    .from(schema.eggs);

  return (
    <div className="space-y-6">
      <Header subtitle="Choisis un template ou pars d'une image Docker" back="/servers" />

      {eggs.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <EggIcon className="size-4" aria-hidden />
            Depuis un template
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {eggs.map((egg) => (
              <li key={egg.id}>
                <Link
                  href={`/servers/new?egg=${egg.id}`}
                  className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-card-hover"
                >
                  <div className="flex items-center gap-2">
                    <Rocket className="size-4 text-accent" aria-hidden />
                    <span className="truncate text-sm font-semibold">
                      {egg.name}
                    </span>
                  </div>
                  {egg.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                      {egg.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Boxes className="size-4" aria-hidden />
          Avancé
        </h2>
        <Link
          href="/servers/new?mode=custom"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-card-hover"
        >
          <Boxes className="size-5 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Image Docker libre</p>
            <p className="text-xs text-muted-foreground">
              Choisis n&apos;importe quelle image et ses variables toi-même.
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}
