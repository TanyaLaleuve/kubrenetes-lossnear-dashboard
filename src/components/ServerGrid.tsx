"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GripVertical, RotateCcw } from "lucide-react";
import { StatusBadge, type Tone } from "@/components/StatusBadge";

export type ServerCardItem = {
  id: string;
  name: string;
  image: string;
  /** Adresse de connexion affichée (domaine ou IP, port selon le réglage). */
  address: string;
  memoryMi: number;
  cpuMilli: number;
  diskGi: number;
  ageLabel: string;
  status: { label: string; tone: Tone };
};

/** Ordre personnalisé par utilisateur, mémorisé en local (par navigateur). */
function storageKey(userId: string) {
  return `lossnear:server-order:${userId}`;
}

function loadOrder(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveOrder(userId: string, order: string[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(order));
  } catch {
    // stockage indisponible (navigation privée…) — tant pis, pas critique.
  }
}

export function ServerGrid({
  userId,
  items,
}: {
  userId: string;
  items: ServerCardItem[];
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Lecture de l'ordre sauvegardé au montage (client uniquement, évite un
  // mismatch d'hydratation entre serveur et navigateur). Micro-défer : évite
  // un setState synchrone dans l'effet.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.resolve().then(() => {
      setOrder(loadOrder(userId));
      setHydrated(true);
    });
  }, [userId]);

  const sorted = useMemo(() => {
    if (!order) return items;
    const byId = new Map(items.map((i) => [i.id, i]));
    const known = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const rest = items.filter((i) => !order.includes(i.id));
    return [...known, ...rest];
  }, [items, order]);

  function persist(next: ServerCardItem[]) {
    const ids = next.map((i) => i.id);
    setOrder(ids);
    saveOrder(userId, ids);
  }

  function onDrop(targetIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === targetIndex) return;
    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    persist(next);
  }

  const isCustom = order !== null;

  if (!hydrated) return null; // évite un flash mal ordonné avant lecture locale

  return (
    <div className="space-y-2">
      {isCustom && (
        <button
          type="button"
          onClick={() => {
            setOrder(null);
            try {
              localStorage.removeItem(storageKey(userId));
            } catch {
              // ignore
            }
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <RotateCcw className="size-3" aria-hidden />
          Réinitialiser l&apos;ordre
        </button>
      )}

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {sorted.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (overIndex !== index) setOverIndex(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(index);
            }}
            className={`flex items-center gap-1 rounded-xl border bg-card transition-colors duration-150 ${
              overIndex === index ? "border-accent/60" : "border-border"
            }`}
          >
            <span
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setOverIndex(null);
              }}
              className="grid h-full shrink-0 cursor-grab touch-none place-items-center self-stretch px-2 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
              aria-label="Réordonner"
              role="button"
            >
              <GripVertical className="size-4" aria-hidden />
            </span>
            <Link
              href={`/servers/${item.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 transition-colors duration-150 hover:bg-card-hover"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-mono text-sm font-semibold">
                    {item.name}
                  </p>
                  <StatusBadge label={item.status.label} tone={item.status.tone} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.image}
                </p>
              </div>
              <div className="hidden max-w-56 shrink-0 font-mono text-xs text-muted-foreground sm:block">
                <p className="truncate">{item.address}</p>
                <p className="mt-0.5">
                  {item.memoryMi} Mio · {item.cpuMilli}m
                </p>
              </div>
              <div className="min-w-0 shrink-0 text-right font-mono text-[10px] text-muted-foreground sm:hidden">
                <p className="truncate">{item.address}</p>
                <p>{item.ageLabel}</p>
              </div>
              <p className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">
                {item.ageLabel}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
