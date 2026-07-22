"use client";

import { useActionState } from "react";
import {
  createServerFromEgg,
  type ServerFormState,
} from "@/lib/servers/actions";
import type { EggVariable } from "@/lib/servers/eggs";

const initialState: ServerFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-accent";

type EggLite = {
  id: string;
  dockerImages: Record<string, string>;
  variables: EggVariable[];
};

export function EggServerForm({
  egg,
  maxMemoryMi,
  maxCpuMilli,
  maxDiskGi,
  canChoosePort,
  portMin,
  portMax,
  portsLabel,
}: {
  egg: EggLite;
  maxMemoryMi: number;
  maxCpuMilli: number;
  maxDiskGi: number;
  canChoosePort: boolean;
  portMin: number;
  portMax: number;
  portsLabel: string;
}) {
  const [state, action, pending] = useActionState(
    createServerFromEgg,
    initialState,
  );

  const imageEntries = Object.entries(egg.dockerImages);
  const editable = egg.variables.filter((v) => v.userViewable);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="eggId" value={egg.id} />

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
          Version / image
        </label>
        <select id="image" name="image" className={`${inputClass} font-mono`}>
          {imageEntries.map(([label, image]) => (
            <option key={image} value={image}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {editable.length > 0 && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Configuration</legend>
          {editable.map((v) => (
            <div key={v.envVariable} className="space-y-1.5">
              <label
                htmlFor={`var_${v.envVariable}`}
                className="text-sm font-medium"
              >
                {v.name || v.envVariable}
                {!v.userEditable && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (fixe)
                  </span>
                )}
              </label>
              <input
                id={`var_${v.envVariable}`}
                name={`var_${v.envVariable}`}
                defaultValue={v.defaultValue}
                readOnly={!v.userEditable}
                placeholder={v.defaultValue}
                className={`${inputClass} font-mono ${
                  !v.userEditable ? "opacity-60" : ""
                }`}
              />
              {v.description && (
                <p className="text-xs text-muted-foreground">{v.description}</p>
              )}
            </div>
          ))}
        </fieldset>
      )}

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
          <label
            htmlFor="containerPort"
            className="text-xs text-muted-foreground"
          >
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
        {canChoosePort && (
          <div className="space-y-1.5">
            <label htmlFor="hostPort" className="text-xs text-muted-foreground">
              Port externe (optionnel)
            </label>
            <input
              id="hostPort"
              name="hostPort"
              type="number"
              min={portMin}
              max={portMax}
              placeholder="auto"
              data-keep-empty
              className={inputClass}
            />
          </div>
        )}
      </fieldset>
      {canChoosePort && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Port externe : vide = attribué automatiquement. Autorisés :{" "}
          {portsLabel}.
        </p>
      )}

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
