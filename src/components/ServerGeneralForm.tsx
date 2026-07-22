"use client";

import { useActionState } from "react";
import { Cpu, HardDrive, MemoryStick, Save, User, Globe, Server } from "lucide-react";
import { updateServerGeneralSettings, type ServerFormState } from "@/lib/servers/actions";
import type { Server as ServerType } from "@/lib/db/schema";

type UserItem = {
  id: string;
  username: string;
};

export function ServerGeneralForm({
  server,
  users,
  isPrivileged,
}: {
  server: ServerType;
  users: UserItem[];
  isPrivileged: boolean;
}) {
  const [state, formAction, pending] = useActionState<ServerFormState, FormData>(
    updateServerGeneralSettings,
    {},
  );

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold">Paramètres Généraux</h2>
        <p className="text-xs text-muted-foreground">
          Modifiez l'identité, le propriétaire et les ressources allouées à ce serveur.
        </p>
      </div>

      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
          {state.error}
        </div>
      )}

      <input type="hidden" name="serverId" value={server.id} />

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Nom du serveur */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Server className="size-3.5" /> Nom du serveur
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={server.name}
            disabled={!isPrivileged}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Propriétaire */}
        <div className="space-y-2">
          <label htmlFor="ownerId" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="size-3.5" /> Propriétaire
          </label>
          <select
            id="ownerId"
            name="ownerId"
            defaultValue={server.ownerId}
            disabled={!isPrivileged}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} {u.id === server.ownerId ? "(Actuel)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* RAM (Mio) */}
        <div className="space-y-2">
          <label htmlFor="memoryMi" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <MemoryStick className="size-3.5" /> RAM Allouée (Mio)
          </label>
          <input
            id="memoryMi"
            name="memoryMi"
            type="number"
            min={256}
            max={32768}
            step={256}
            required
            defaultValue={server.memoryMi}
            disabled={!isPrivileged}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">Ex: 1024 = 1 Go, 2048 = 2 Go, 4096 = 4 Go</p>
        </div>

        {/* CPU (millicœurs) */}
        <div className="space-y-2">
          <label htmlFor="cpuMilli" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Cpu className="size-3.5" /> CPU Limit (millicœurs)
          </label>
          <input
            id="cpuMilli"
            name="cpuMilli"
            type="number"
            min={250}
            max={16000}
            step={250}
            required
            defaultValue={server.cpuMilli}
            disabled={!isPrivileged}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">Ex: 1000 = 1 vCPU, 2000 = 2 vCPU</p>
        </div>

        {/* Disque (Gio) */}
        <div className="space-y-2">
          <label htmlFor="diskGi" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="size-3.5" /> Stockage Disque (Gio)
          </label>
          <input
            id="diskGi"
            name="diskGi"
            type="number"
            min={1}
            max={200}
            required
            defaultValue={server.diskGi}
            disabled
            title="La taille du disque est fixée à la création."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">
            Non modifiable après création (volume Kubernetes immuable).
          </p>
        </div>

        {/* Port conteneur */}
        <div className="space-y-2">
          <label htmlFor="containerPort" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Server className="size-3.5" /> Port conteneur
          </label>
          <input
            id="containerPort"
            name="containerPort"
            type="number"
            min={1}
            max={65535}
            required
            defaultValue={server.containerPort}
            disabled={!isPrivileged}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">Port interne (Minecraft = 25565)</p>
        </div>

        {/* Adresse d'affichage */}
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="displayAddress" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3.5" /> Adresse personnalisée d'affichage (optionnel)
          </label>
          <input
            id="displayAddress"
            name="displayAddress"
            type="text"
            placeholder="play.example.com"
            defaultValue={server.displayAddress ?? ""}
            disabled={!isPrivileged}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {isPrivileged && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            <Save className="size-4" />
            {pending ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      )}
    </form>
  );
}
