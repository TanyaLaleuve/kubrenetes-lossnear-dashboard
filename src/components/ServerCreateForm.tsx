"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createServer, type ServerFormState } from "@/lib/servers/actions";

const initialState: ServerFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-accent";

type EnvRow = { key: string; value: string };

export function ServerCreateForm({
  maxMemoryMi,
  maxCpuMilli,
  maxDiskGi,
}: {
  maxMemoryMi: number;
  maxCpuMilli: number;
  maxDiskGi: number;
}) {
  const [state, action, pending] = useActionState(createServer, initialState);
  const [envRows, setEnvRows] = useState<EnvRow[]>([
    { key: "EULA", value: "TRUE" },
  ]);

  const envJson = JSON.stringify(
    Object.fromEntries(
      envRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]),
    ),
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="env" value={envJson} />

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Nom du serveur
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={3}
          maxLength={48}
          placeholder="Serveur de Tanya"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="image" className="text-sm font-medium">
          Image Docker
        </label>
        <input
          id="image"
          name="image"
          placeholder="itzg/minecraft-server:latest"
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Vide = valeur du placeholder. Minecraft récent :{" "}
          <code className="font-mono">itzg/minecraft-server:latest</code>. Vieilles
          versions (1.8.x à 1.16, Java 8) :{" "}
          <code className="font-mono">itzg/minecraft-server:java8-multiarch</code>{" "}
          avec <code className="font-mono">VERSION=1.8.8</code>. EULA=TRUE requis,
          TYPE=PAPER pour Paper.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="command" className="text-sm font-medium">
          Arguments de démarrage (optionnel)
        </label>
        <input
          id="command"
          name="command"
          maxLength={500}
          className={`${inputClass} font-mono`}
        />
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-medium">Ressources</legend>
        <div className="space-y-1.5">
          <label htmlFor="memoryMi" className="text-xs text-muted-foreground">
            RAM (Mio, max {maxMemoryMi})
          </label>
          <input
            id="memoryMi"
            name="memoryMi"
            type="number"
            required
            min={256}
            max={maxMemoryMi}
            defaultValue={Math.min(2048, maxMemoryMi)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cpuMilli" className="text-xs text-muted-foreground">
            CPU (milli, max {maxCpuMilli})
          </label>
          <input
            id="cpuMilli"
            name="cpuMilli"
            type="number"
            required
            min={250}
            max={maxCpuMilli}
            defaultValue={Math.min(1000, maxCpuMilli)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="diskGi" className="text-xs text-muted-foreground">
            Disque (Gio, max {maxDiskGi})
          </label>
          <input
            id="diskGi"
            name="diskGi"
            type="number"
            required
            min={1}
            max={maxDiskGi}
            defaultValue={Math.min(5, maxDiskGi)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="containerPort" className="text-xs text-muted-foreground">
            Port interne
          </label>
          <input
            id="containerPort"
            name="containerPort"
            type="number"
            required
            min={1}
            max={65535}
            defaultValue={25565}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Variables d&apos;environnement
        </legend>
        {envRows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label={`Nom de la variable ${index + 1}`}
              value={row.key}
              onChange={(e) =>
                setEnvRows((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, key: e.target.value } : r,
                  ),
                )
              }
              placeholder="CLE"
              className={`${inputClass} font-mono uppercase`}
            />
            <input
              aria-label={`Valeur de la variable ${index + 1}`}
              value={row.value}
              onChange={(e) =>
                setEnvRows((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, value: e.target.value } : r,
                  ),
                )
              }
              placeholder="valeur"
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              aria-label={`Supprimer la variable ${index + 1}`}
              onClick={() =>
                setEnvRows((rows) => rows.filter((_, i) => i !== index))
              }
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-destructive"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setEnvRows((rows) => [...rows, { key: "", value: "" }])}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <Plus className="size-3.5" aria-hidden />
          Ajouter une variable
        </button>
      </fieldset>

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
        {pending ? "Création…" : "Créer le serveur"}
      </button>
    </form>
  );
}
