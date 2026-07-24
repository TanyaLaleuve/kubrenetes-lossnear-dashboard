"use client";

import { useActionState, useState } from "react";
import { Code, Container, Egg as EggIcon, Save, Terminal } from "lucide-react";
import { updateServerEggSettings, type ServerFormState } from "@/lib/servers/actions";
import type { Egg as EggType, Server as ServerType } from "@/lib/db/schema";
import { builtinVars, substituteVars } from "@/lib/servers/eggs";

export function ServerEggForm({
  server,
  egg,
  canEdit,
  canEditStartupCommand = false,
}: {
  server: ServerType;
  egg: EggType | null;
  canEdit: boolean;
  /** Permission settings.startup_command : éditer la ligne de démarrage brute. */
  canEditStartupCommand?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ServerFormState, FormData>(
    updateServerEggSettings,
    {},
  );

  const [selectedImage, setSelectedImage] = useState(server.image);

  // Reconstituer l'environnement actuel pour l'affichage / substitution des variables
  const builtins = builtinVars({
    memoryMi: server.memoryMi,
    containerPort: server.containerPort,
  });

  const previewVars = {
    ...builtins,
    ...server.env,
  };

  // Ligne de démarrage : lecture seule ici, modifiable depuis Paramètres.
  const startup = server.startup ?? egg?.startup ?? "";
  const startupPreview = substituteVars(startup, previewVars);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <EggIcon className="size-5 text-accent" /> Configuration de l&apos;Egg & Conteneur
        </h2>
        <p className="text-xs text-muted-foreground">
          {egg
            ? `Serveur basé sur l'Egg : ${egg.name}`
            : "Conteneur Docker personnalisé (sans Egg prédéfini)."}
        </p>
      </div>

      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
          {state.success}
        </div>
      )}

      <input type="hidden" name="serverId" value={server.id} />

      {/* Choix de l'image Docker */}
      <div className="space-y-2">
        <label htmlFor="image" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Container className="size-3.5" /> Image Docker
        </label>
        {egg && Object.keys(egg.dockerImages).length > 0 ? (
          <select
            id="image"
            name="image"
            value={selectedImage}
            onChange={(e) => setSelectedImage(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          >
            {Object.entries(egg.dockerImages).map(([label, img]) => (
              <option key={img} value={img}>
                {label} ({img})
              </option>
            ))}
          </select>
        ) : (
          <input
            id="image"
            name="image"
            type="text"
            required
            value={selectedImage}
            onChange={(e) => setSelectedImage(e.target.value)}
            disabled={!canEdit}
            placeholder="itzg/minecraft-server:latest"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
        )}
      </div>

      {/* Ligne de démarrage : éditable avec la permission dédiée, sinon aperçu. */}
      <div className="space-y-2">
        <label
          htmlFor="startup"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <Terminal className="size-3.5" /> Ligne de démarrage
        </label>
        {canEditStartupCommand ? (
          <>
            <textarea
              id="startup"
              name="startup"
              rows={2}
              defaultValue={startup}
              disabled={!canEdit}
              data-keep-empty
              placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Exécutée via <code className="font-mono">sh -c</code>. Utilise{" "}
              <code className="font-mono">{"{{VARIABLE}}"}</code> pour insérer une
              variable. Aperçu :{" "}
              <span className="font-mono text-accent">{startupPreview || "(aucune)"}</span>
            </p>
          </>
        ) : (
          <>
            <div className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3">
              <p className="font-mono text-xs break-all text-accent">
                {startupPreview || "(aucune)"}
              </p>
              {startup && startup !== startupPreview && (
                <p className="font-mono text-[11px] break-all text-muted-foreground">
                  modèle : {startup}
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Générée à partir des variables ci-dessous. Sa modification demande
              une permission dédiée.
            </p>
          </>
        )}
      </div>

      {/* Variables de l'Egg */}
      {egg && egg.variables.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Code className="size-4 text-muted-foreground" /> Variables d&apos;environnement de l&apos;Egg
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {egg.variables
              .filter((v) => v.userViewable)
              .map((v) => {
                const currentValue = server.env[v.envVariable] ?? v.defaultValue;
                return (
                  <div key={v.envVariable} className="space-y-1.5">
                    <label
                      htmlFor={`var_${v.envVariable}`}
                      className="text-xs font-medium text-foreground flex items-center justify-between"
                    >
                      <span>{v.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {`{{${v.envVariable}}}`}
                      </span>
                    </label>
                    <input
                      id={`var_${v.envVariable}`}
                      name={`var_${v.envVariable}`}
                      type="text"
                      defaultValue={currentValue}
                      disabled={!v.userEditable || !canEdit}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
                    />
                    {v.description && (
                      <p className="text-[11px] text-muted-foreground">{v.description}</p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            <Save className="size-4" />
            {pending ? "Enregistrement..." : "Enregistrer la configuration"}
          </button>
        </div>
      )}
    </form>
  );
}
