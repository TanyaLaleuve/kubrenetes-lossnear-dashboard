import Link from "next/link";
import { desc } from "drizzle-orm";
import { Egg as EggIcon, Plus, Upload } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Templates (eggs)" };

export default async function EggsPage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  const eggs = await db()
    .select()
    .from(schema.eggs)
    .orderBy(desc(schema.eggs.createdAt));

  // Regroupement par catégorie, "Sans catégorie" en dernier.
  const byCategory = new Map<string, typeof eggs>();
  for (const egg of eggs) {
    const key = egg.category?.trim() || "Sans catégorie";
    const list = byCategory.get(key) ?? [];
    list.push(egg);
    byCategory.set(key, list);
  }
  const groupedEggs = [...byCategory.entries()].sort(([a], [b]) => {
    if (a === "Sans catégorie") return 1;
    if (b === "Sans catégorie") return -1;
    return a.localeCompare(b, "fr");
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Templates (eggs)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Modèles de serveurs réutilisables · {eggs.length} template
            {eggs.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/eggs/import"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
          >
            <Upload className="size-4" aria-hidden />
            Importer
          </Link>
          <Link
            href="/eggs/new"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Nouveau
          </Link>
        </div>
      </header>

      {eggs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <EggIcon
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun template. Importe un egg Pterodactyl ou crée-en un.
          </p>
        </div>
      ) : (
        groupedEggs.map(([category, list]) => (
        <section key={category} className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {category}
            <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px]">
              {list.length}
            </span>
          </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((egg) => (
            <li key={egg.id}>
              <Link
                href={`/eggs/${egg.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-card-hover"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{egg.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      egg.source === "imported"
                        ? "bg-info/10 text-info"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {egg.source === "imported" ? "importé" : "maison"}
                  </span>
                </div>
                {egg.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                    {egg.description}
                  </p>
                )}
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {Object.keys(egg.dockerImages).length} image
                  {Object.keys(egg.dockerImages).length > 1 ? "s" : ""} ·{" "}
                  {egg.variables.length} variable
                  {egg.variables.length > 1 ? "s" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        </section>
        ))
      )}
    </div>
  );
}
