"use client";

import { useActionState } from "react";
import { saveEgg, type EggFormState } from "@/lib/servers/egg-actions";
import type { Egg } from "@/lib/db/schema";

const initialState: EggFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-accent";

function imagesToText(images: Record<string, string>): string {
  return Object.entries(images)
    .map(([label, image]) => `${label} = ${image}`)
    .join("\n");
}

export function EggForm({ egg }: { egg?: Egg }) {
  const [state, action, pending] = useActionState(saveEgg, initialState);

  return (
    <form action={action} className="space-y-5" data-keep-empty>
      {egg && <input type="hidden" name="eggId" value={egg.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Nom du template
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={egg?.name}
            placeholder="Paper 1.20"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="author" className="text-sm font-medium">
            Auteur (optionnel)
          </label>
          <input
            id="author"
            name="author"
            defaultValue={egg?.author ?? ""}
            placeholder="lossnear"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={egg?.description}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="images" className="text-sm font-medium">
          Images Docker
        </label>
        <textarea
          id="images"
          name="images"
          rows={3}
          required
          defaultValue={egg ? imagesToText(egg.dockerImages) : ""}
          placeholder={"Java 17 = ghcr.io/pterodactyl/yolks:java_17\nJava 21 = ghcr.io/pterodactyl/yolks:java_21"}
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Une variante par ligne, format{" "}
          <code className="font-mono">libellé = image</code>. La première est
          proposée par défaut.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="startup" className="text-sm font-medium">
          Commande de démarrage
        </label>
        <textarea
          id="startup"
          name="startup"
          rows={2}
          defaultValue={egg?.startup}
          placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}"
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Exécutée via <code className="font-mono">sh -c</code>. Utilise{" "}
          <code className="font-mono">{"{{VARIABLE}}"}</code> pour insérer une
          variable.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="stopCommand" className="text-sm font-medium">
            Commande d&apos;arrêt
          </label>
          <input
            id="stopCommand"
            name="stopCommand"
            defaultValue={egg?.stopCommand ?? ""}
            placeholder="stop"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="installContainer" className="text-sm font-medium">
            Image d&apos;install
          </label>
          <input
            id="installContainer"
            name="installContainer"
            defaultValue={egg?.installContainer ?? ""}
            placeholder="debian:bookworm-slim"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="installEntrypoint" className="text-sm font-medium">
            Entrypoint install
          </label>
          <input
            id="installEntrypoint"
            name="installEntrypoint"
            defaultValue={egg?.installEntrypoint ?? ""}
            placeholder="bash"
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="installScript" className="text-sm font-medium">
          Script d&apos;installation (optionnel)
        </label>
        <textarea
          id="installScript"
          name="installScript"
          rows={6}
          defaultValue={egg?.installScript ?? ""}
          placeholder={"#!/bin/bash\ncd /mnt/server\ncurl -sSL -o server.jar https://..."}
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Joué une seule fois au 1<sup>er</sup> démarrage. Le volume est monté
          sur <code className="font-mono">/mnt/server</code>.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="variables" className="text-sm font-medium">
          Variables (JSON)
        </label>
        <textarea
          id="variables"
          name="variables"
          rows={5}
          defaultValue={
            egg && egg.variables.length
              ? JSON.stringify(egg.variables, null, 2)
              : ""
          }
          placeholder={`[\n  { "name": "Fichier jar", "envVariable": "SERVER_JARFILE", "defaultValue": "server.jar", "userEditable": true, "userViewable": true }\n]`}
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Tableau d&apos;objets. Champs :{" "}
          <code className="font-mono">envVariable</code> (requis), name,
          description, defaultValue, userEditable, userViewable.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {pending ? "Enregistrement…" : egg ? "Enregistrer" : "Créer le template"}
      </button>
    </form>
  );
}
