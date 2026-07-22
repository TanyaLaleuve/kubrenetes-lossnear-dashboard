"use client";

import { useActionState, useState } from "react";
import { Code, Container, Egg as EggIcon, Save, Terminal } from "lucide-react";
import { updateServerEggSettings, type ServerFormState } from "@/lib/servers/actions";
import type { Egg as EggType, Server as ServerType } from "@/lib/db/schema";
import { builtinVars, substituteVars } from "@/lib/servers/eggs";

export function ServerEggForm({
  server,
  egg,
  isPrivileged,
}: {
  server: ServerType;
  egg: EggType | null;
  isPrivileged: boolean;
}) {
  const [state, formAction, pending] = useActionState<ServerFormState, FormData>(
    updateServerEggSettings,
    {},
  );

  const [startup, setStartup] = useState(server.startup ?? egg?.startup ?? "");
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
            disabled={!isPrivileged}
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
            disabled={!isPrivileged}
            placeholder="itzg/minecraft-server:latest"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
        )}
      </div>

      {/* Commande de démarrage */}
      <div className="space-y-2">
        <label htmlFor="startup" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Terminal className="size-3.5" /> Commande de démarrage (Startup)
        </label>
        <textarea
          id="startup"
          name="startup"
          rows={3}
          value={startup}
          onChange={(e) => setStartup(e.target.value)}
          disabled={!isPrivileged}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
        />
        {startup && (
          <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Aperçu résolu de la commande :</span>
            <p className="font-mono text-xs text-accent break-all">{startupPreview || "(vide)"}</p>
          </div>
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
                      disabled={!v.userEditable || !isPrivileged}
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

      {isPrivileged && (
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
