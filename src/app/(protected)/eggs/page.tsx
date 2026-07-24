import Link from "next/link";
import { asc } from "drizzle-orm";
import { Egg as EggIcon, Plus, Upload } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { EggBoard, type EggGroup } from "@/components/EggBoard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Templates (eggs)" };

export default async function EggsPage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  const eggs = await db()
    .select()
    .from(schema.eggs)
    .orderBy(asc(schema.eggs.sortOrder), asc(schema.eggs.name));

  // Regroupement par catégorie, "Sans catégorie" en dernier. L'ordre au sein
  // d'une catégorie suit sortOrder (glisser-déposer).
  const byCategory = new Map<string, typeof eggs>();
  for (const egg of eggs) {
    const key = egg.category?.trim() || "Sans catégorie";
    const list = byCategory.get(key) ?? [];
    list.push(egg);
    byCategory.set(key, list);
  }
  const groups: EggGroup[] = [...byCategory.entries()]
    .sort(([a], [b]) => {
      if (a === "Sans catégorie") return 1;
      if (b === "Sans catégorie") return -1;
      return a.localeCompare(b, "fr");
    })
    .map(([category, list]) => ({
      category,
      eggs: list.map((egg) => ({
        id: egg.id,
        name: egg.name,
        description: egg.description,
        source: egg.source,
        imageCount: Object.keys(egg.dockerImages).length,
        varCount: egg.variables.length,
      })),
    }));

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
        <>
          <p className="text-xs text-muted-foreground">
            Glisse-dépose les cartes pour réorganiser une catégorie.
          </p>
          <EggBoard groups={groups} />
        </>
      )}
    </div>
  );
}
