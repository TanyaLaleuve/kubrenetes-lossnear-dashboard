"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { reorderEggs } from "@/lib/servers/egg-actions";

export type EggCard = {
  id: string;
  name: string;
  description: string;
  source: "imported" | "custom";
  imageCount: number;
  varCount: number;
};

export type EggGroup = { category: string; eggs: EggCard[] };

/**
 * Liste des eggs regroupés par catégorie, réordonnables par glisser-déposer au
 * sein de chaque catégorie. L'ordre est persisté (sortOrder) via reorderEggs.
 */
export function EggBoard({ groups }: { groups: EggGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <CategoryGroup key={group.category} group={group} />
      ))}
    </div>
  );
}

function CategoryGroup({ group }: { group: EggGroup }) {
  const [eggs, setEggs] = useState(group.eggs);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startSave] = useTransition();

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = eggs.findIndex((e) => e.id === dragId);
    const to = eggs.findIndex((e) => e.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...eggs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEggs(next);
    setDragId(null);
    startSave(async () => reorderEggs(next.map((e) => e.id)));
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {group.category}
        <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px]">
          {eggs.length}
        </span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {eggs.map((egg) => (
          <li
            key={egg.id}
            draggable
            onDragStart={() => setDragId(egg.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(egg.id)}
            className={`group/egg relative rounded-xl border bg-card transition-colors duration-150 ${
              dragId === egg.id
                ? "border-accent/50 opacity-60"
                : "border-border hover:bg-card-hover"
            }`}
          >
            <span
              aria-hidden
              className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/egg:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </span>
            <Link href={`/eggs/${egg.id}`} className="block p-4 pl-7">
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
                {egg.imageCount} image{egg.imageCount > 1 ? "s" : ""} ·{" "}
                {egg.varCount} variable{egg.varCount > 1 ? "s" : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
