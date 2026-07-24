"use client";

import { useState, useTransition, type ComponentType } from "react";
import {
  Castle,
  Feather,
  Flame,
  Gamepad2,
  Ghost,
  Globe,
  ListChecks,
  PawPrint,
  Skull,
  SquareTerminal,
  Swords,
  Users,
} from "lucide-react";
import { setMinecraftProp } from "@/lib/servers/minecraft-actions";

/**
 * Panneau de propriétés Minecraft (server.properties), affiché sur la page
 * console des serveurs détectés comme Minecraft. Boutons style « blocky » : le
 * clic bascule la propriété (effet au redémarrage). Les icônes sont des
 * pictogrammes libres — pas les textures Mojang (copyright) ; remplaçables.
 */

type PropKey = string;

const PROPS: { key: PropKey; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "online-mode", label: "Mode online", icon: Globe },
  { key: "pvp", label: "Activer PVP", icon: Swords },
  { key: "force-gamemode", label: "Forcer gamemode", icon: Gamepad2 },
  { key: "generate-structures", label: "Générer structures", icon: Castle },
  { key: "spawn-animals", label: "Présence animaux", icon: PawPrint },
  { key: "spawn-monsters", label: "Présence monstres", icon: Ghost },
  { key: "spawn-npcs", label: "Générer NPCs", icon: Users },
  { key: "enable-command-block", label: "Activer cmdblocks", icon: SquareTerminal },
  { key: "white-list", label: "Activer whitelist", icon: ListChecks },
  { key: "allow-flight", label: "Autoriser flight", icon: Feather },
  { key: "allow-nether", label: "Autoriser nether", icon: Flame },
  { key: "hardcore", label: "Activer hardcore", icon: Skull },
];

export function MinecraftPanel({
  serverId,
  initial,
  exists,
  canEdit,
}: {
  serverId: string;
  initial: Record<string, boolean>;
  /** server.properties existe déjà (serveur démarré au moins une fois). */
  exists: boolean;
  canEdit: boolean;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(initial);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(key: string) {
    if (!canEdit || pendingKey) return;
    const nextVal = !values[key];
    setPendingKey(key);
    setError(null);
    startTransition(async () => {
      const res = await setMinecraftProp(serverId, key, nextVal);
      if ("error" in res) setError(res.error);
      else setValues(res.values);
      setPendingKey(null);
    });
  }

  return (
    <section aria-label="Propriétés Minecraft" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Autres propriétés
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {exists
            ? "Prend effet au prochain redémarrage."
            : "Valeurs par défaut — le fichier sera créé au 1er démarrage."}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PROPS.map(({ key, label, icon: Icon }) => {
          const on = !!values[key];
          const loading = pendingKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              disabled={!canEdit || !!pendingKey}
              aria-pressed={on}
              className={`group flex items-center gap-2.5 rounded-md border-2 p-2 text-left transition-all duration-150 ${
                on
                  ? "border-warning/70 bg-gradient-to-b from-card-hover to-card shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  : "border-border bg-card opacity-70"
              } ${canEdit ? "cursor-pointer hover:border-warning/50 hover:opacity-100 disabled:cursor-wait" : "cursor-default"}`}
            >
              {/* Vignette « bloc » */}
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-sm border-2 ${
                  on
                    ? "border-warning/40 bg-background text-warning"
                    : "border-border bg-background text-muted-foreground grayscale"
                }`}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11px] font-bold uppercase leading-tight tracking-wide">
                  {label}
                </span>
                <span
                  className={`text-[10px] font-semibold ${on ? "text-warning" : "text-muted-foreground"}`}
                >
                  {loading ? "…" : on ? "ON" : "OFF"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!canEdit && (
        <p className="text-[11px] text-muted-foreground">
          Lecture seule — il faut la permission d&apos;écriture des fichiers pour
          modifier.
        </p>
      )}
    </section>
  );
}
