"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Rocket, Search } from "lucide-react";

export type EggPickerItem = {
  id: string;
  name: string;
  description: string;
  category: string | null;
};

const UNCATEGORIZED = "Sans catégorie";

/**
 * Sélecteur d'egg à la création de serveur : recherche plein-texte + filtres
 * par catégorie, résultats regroupés par catégorie. Tout se fait côté client
 * (la liste des eggs est petite).
 */
export function EggPicker({ eggs }: { eggs: EggPickerItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  // Catégories présentes, triées ; "Sans catégorie" toujours en dernier.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const egg of eggs) set.add(egg.category?.trim() || UNCATEGORIZED);
    return [...set].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b, "fr");
    });
  }, [eggs]);

  const q = query.trim().toLowerCase();

  // Filtrage (recherche + catégorie active) puis regroupement par catégorie.
  const groups = useMemo(() => {
    const filtered = eggs.filter((egg) => {
      const cat = egg.category?.trim() || UNCATEGORIZED;
      if (category && cat !== category) return false;
      if (!q) return true;
      return (
        egg.name.toLowerCase().includes(q) ||
        egg.description.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
    const byCat = new Map<string, EggPickerItem[]>();
    for (const egg of filtered) {
      const cat = egg.category?.trim() || UNCATEGORIZED;
      const list = byCat.get(cat) ?? [];
      list.push(egg);
      byCat.set(cat, list);
    }
    return categories
      .filter((cat) => byCat.has(cat))
      .map((cat) => [cat, byCat.get(cat)!] as const);
  }, [eggs, categories, category, q]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);
  const multiCategory = categories.length > 1;

  return (
    <div className="space-y-4">
      {/* Recherche + filtres par catégorie */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un template…"
            data-keep-empty
            aria-label="Rechercher un template"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>

        {multiCategory && (
          <div className="flex flex-wrap gap-2">
            <Chip active={category === null} onClick={() => setCategory(null)}>
              Toutes
            </Chip>
            {categories.map((cat) => (
              <Chip
                key={cat}
                active={category === cat}
                onClick={() => setCategory(category === cat ? null : cat)}
              >
                {cat}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun template ne correspond à ta recherche.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([cat, list]) => (
            <section key={cat} className="space-y-2">
              {/* En-tête de catégorie (masqué s'il n'y en a qu'une seule). */}
              {multiCategory && (
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat}
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px]">
                    {list.length}
                  </span>
                </h3>
              )}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((egg) => (
                  <li key={egg.id}>
                    <Link
                      href={`/servers/new?egg=${egg.id}`}
                      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors duration-150 hover:border-accent/40 hover:bg-card-hover"
                    >
                      <div className="flex items-center gap-1.5">
                        <Rocket className="size-4 shrink-0 text-accent" aria-hidden />
                        <span className="truncate text-sm font-semibold">
                          {egg.name}
                        </span>
                      </div>
                      {egg.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {egg.description}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border text-muted-foreground hover:bg-card-hover hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
