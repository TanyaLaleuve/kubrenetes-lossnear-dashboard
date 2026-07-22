"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Copy, Check, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  addImage,
  deleteImage,
  updateImage,
  type ImageFormState,
} from "@/lib/images/actions";
import { parseImageRef } from "@/lib/images/image-ref";

const initialState: ImageFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent";

export type CatalogItem = {
  id: string;
  reference: string;
  label: string | null;
  category: string | null;
  source: "manual" | "egg";
  usedBy: number;
};

type GroupBy = "category" | "registry" | "none";
type SortBy = "name" | "usage";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard indisponible */
        }
      }}
      aria-label="Copier la référence"
      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-accent"
    >
      {copied ? (
        <Check className="size-3.5 text-accent" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </button>
  );
}

function AddForm({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState(addImage, initialState);
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium">
        <Plus className="size-4 text-accent" aria-hidden />
        Ajouter une image
      </summary>
      <form action={action} data-keep-empty className="space-y-3 border-t border-border p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="img-ref" className="text-xs text-muted-foreground">
              Référence de l&apos;image
            </label>
            <input
              id="img-ref"
              name="reference"
              required
              placeholder="ghcr.io/pterodactyl/yolks:java_17"
              className={`mt-1 ${inputClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="img-label" className="text-xs text-muted-foreground">
              Libellé (optionnel)
            </label>
            <input
              id="img-label"
              name="label"
              placeholder="Java 17"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="img-cat" className="text-xs text-muted-foreground">
              Catégorie (optionnel)
            </label>
            <input
              id="img-cat"
              name="category"
              list="image-categories"
              placeholder="Minecraft, Bots, Bases…"
              className={`mt-1 ${inputClass}`}
            />
            <datalist id="image-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            {pending ? "…" : "Ajouter"}
          </button>
          {state.error && (
            <span role="alert" className="text-xs text-destructive">
              {state.error}
            </span>
          )}
          {state.success && (
            <span className="text-xs text-accent">{state.success}</span>
          )}
        </div>
      </form>
    </details>
  );
}

function ImageRow({
  item,
  categories,
}: {
  item: CatalogItem;
  categories: string[];
}) {
  const [state, action, pending] = useActionState(updateImage, initialState);
  const [removing, startRemove] = useTransition();
  const parsed = parseImageRef(item.reference);

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {item.label || parsed.repository}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {item.reference}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            item.source === "egg"
              ? "bg-info/10 text-info"
              : "bg-accent/10 text-accent"
          }`}
        >
          {item.source === "egg" ? "egg" : "manuel"}
        </span>
        <CopyButton value={item.reference} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="rounded bg-background px-1.5 py-0.5 font-mono">
          {parsed.registry}
        </span>
        <span className="rounded bg-background px-1.5 py-0.5 font-mono">
          :{parsed.tag}
        </span>
        {item.category && (
          <span className="rounded bg-background px-1.5 py-0.5">
            {item.category}
          </span>
        )}
        <span className="ml-auto">
          {item.usedBy > 0
            ? `${item.usedBy} egg${item.usedBy > 1 ? "s" : ""}`
            : "aucun egg"}
        </span>
        <details className="group">
          <summary className="grid size-7 cursor-pointer list-none place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground">
            <Pencil className="size-3.5" aria-hidden />
          </summary>
          <form
            action={action}
            data-keep-empty
            className="mt-2 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={item.id} />
            <div>
              <label className="text-[11px] text-muted-foreground">
                Libellé
                <input
                  name="label"
                  defaultValue={item.label ?? ""}
                  className={`mt-1 ${inputClass} h-8 py-1`}
                />
              </label>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">
                Catégorie
                <input
                  name="category"
                  list="image-categories-edit"
                  defaultValue={item.category ?? ""}
                  className={`mt-1 ${inputClass} h-8 py-1`}
                />
              </label>
            </div>
            <datalist id="image-categories-edit">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={pending}
              className="h-8 cursor-pointer rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
            {state.error && (
              <span role="alert" className="text-xs text-destructive">
                {state.error}
              </span>
            )}
          </form>
        </details>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Retirer « ${item.reference} » du catalogue ?`)) {
              startRemove(async () => deleteImage(item.id));
            }
          }}
          disabled={removing}
          aria-label="Supprimer du catalogue"
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function ImageCatalog({ items }: { items: CatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [sort, setSort] = useState<SortBy>("name");

  const categories = useMemo(
    () =>
      [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(
        (a, b) => a.localeCompare(b, "fr"),
      ),
    [items],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (i) =>
            i.reference.toLowerCase().includes(q) ||
            (i.label ?? "").toLowerCase().includes(q),
        )
      : items;

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "usage" && b.usedBy !== a.usedBy) return b.usedBy - a.usedBy;
      return a.reference.localeCompare(b.reference, "fr", { sensitivity: "base" });
    });

    const keyOf = (i: CatalogItem) => {
      if (groupBy === "none") return "";
      if (groupBy === "registry") return parseImageRef(i.reference).registry;
      return i.category || "Sans catégorie";
    };

    const map = new Map<string, CatalogItem[]>();
    for (const item of sorted) {
      const k = keyOf(item);
      (map.get(k) ?? map.set(k, []).get(k)!).push(item);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [items, query, groupBy, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une image…"
            aria-label="Rechercher"
            className={`${inputClass} pl-9`}
          />
        </div>
        <label className="text-xs text-muted-foreground">
          Regrouper
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className={`ml-1.5 ${inputClass} inline-block w-auto py-1.5`}
          >
            <option value="category">Catégorie</option>
            <option value="registry">Registre</option>
            <option value="none">Aucun</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Trier
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortBy)}
            className={`ml-1.5 ${inputClass} inline-block w-auto py-1.5`}
          >
            <option value="name">Nom</option>
            <option value="usage">Utilisation</option>
          </select>
        </label>
      </div>

      <AddForm categories={categories} />

      {groups.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucune image. Ajoute-en une ou importe un egg.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([groupName, groupItems]) => (
            <section key={groupName || "all"} className="space-y-2">
              {groupBy !== "none" && (
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupName}
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px]">
                    {groupItems.length}
                  </span>
                </h2>
              )}
              <ul className="grid gap-2 sm:grid-cols-2">
                {groupItems.map((item) => (
                  <ImageRow key={item.id} item={item} categories={categories} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
