"use client";

import { useActionState, useState } from "react";
import {
  Cpu,
  Globe,
  HardDrive,
  MemoryStick,
  Save,
  Server,
  Terminal,
  User,
} from "lucide-react";
import { PortCheck } from "@/components/PortCheck";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { updateServerGeneralSettings, type ServerFormState } from "@/lib/servers/actions";
import { PUBLIC_IP } from "@/lib/servers/constants";
import type { Server as ServerType } from "@/lib/db/schema";

type UserItem = {
  id: string;
  username: string;
};

export function ServerGeneralForm({
  server,
  users,
  ownerUsername,
  canEdit,
  isPrivileged,
  canEditStartupCommand,
  canChoosePort,
  portMin,
  portMax,
  portsLabel,
}: {
  server: ServerType;
  /** Permission dédiée : modifier la ligne de démarrage brute. */
  canEditStartupCommand: boolean;
  /** Liste complète des comptes — vide si !isPrivileged (pas envoyée au client). */
  users: UserItem[];
  /** Nom du propriétaire actuel, pour l'affichage en lecture seule. */
  ownerUsername: string;
  /** Peut modifier nom/ressources/ports/adresse (settings.general ou privilégié). */
  canEdit: boolean;
  /** Propriétaire/admin uniquement : seul habilité à changer le propriétaire. */
  isPrivileged: boolean;
  canChoosePort: boolean;
  portMin: number;
  portMax: number;
  portsLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ServerFormState, FormData>(
    updateServerGeneralSettings,
    {},
  );
  const [hostPort, setHostPort] = useState(String(server.hostPort));
  const [domain, setDomain] = useState(server.displayAddress ?? "");
  const [showPort, setShowPort] = useState(server.showPort);

  // Aperçu vivant de ce que verront les joueurs.
  const publicIp = PUBLIC_IP;
  const previewAddress = `${domain.trim() || publicIp}${
    showPort ? `:${hostPort || server.hostPort}` : ""
  }`;

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold">Paramètres Généraux</h2>
        <p className="text-xs text-muted-foreground">
          Modifiez l&apos;identité, le propriétaire et les ressources allouées à ce serveur.
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
            disabled={!canEdit}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Propriétaire */}
        <div className="space-y-2">
          <label htmlFor="ownerId" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="size-3.5" /> Propriétaire
          </label>
          {isPrivileged ? (
            <select
              id="ownerId"
              name="ownerId"
              defaultValue={server.ownerId}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} {u.id === server.ownerId ? "(Actuel)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {ownerUsername}
            </p>
          )}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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

        {/* Port externe (public / hostPort) */}
        <div className="space-y-2">
          <label htmlFor="hostPort" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3.5" /> Port externe (public)
          </label>
          <input
            id="hostPort"
            name="hostPort"
            type="number"
            min={portMin}
            max={portMax}
            required
            value={hostPort}
            onChange={(e) => setHostPort(e.target.value)}
            readOnly={!canChoosePort}
            disabled={!canEdit}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground read-only:opacity-60 focus:border-accent focus:outline-none disabled:opacity-50"
          />
          {canChoosePort && canEdit && hostPort !== String(server.hostPort) && (
            <PortCheck port={hostPort} serverId={server.id} />
          )}
          <p className="text-[11px] text-muted-foreground">
            {canChoosePort
              ? `Port public de connexion. Autorisés : ${portsLabel}. Doit être libre.`
              : "Attribué automatiquement — tu n'as pas la permission de le changer."}
          </p>
        </div>

        {/* Port interne conteneur */}
        <div className="space-y-2">
          <label htmlFor="containerPort" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Server className="size-3.5" /> Port interne (conteneur)
          </label>
          <input
            id="containerPort"
            name="containerPort"
            type="number"
            min={1}
            max={65535}
            required
            defaultValue={server.containerPort}
            disabled={!canEdit}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">Port interne (Minecraft = 25565)</p>
        </div>

        {/* Ligne de démarrage (permission dédiée) */}
        {canEditStartupCommand && (
          <div className="space-y-2 sm:col-span-2">
            <label
              htmlFor="startup"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <Terminal className="size-3.5" /> Ligne de démarrage
            </label>
            <textarea
              id="startup"
              name="startup"
              rows={2}
              defaultValue={server.startup ?? ""}
              disabled={!canEdit}
              placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}"
              data-keep-empty
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Exécutée via <code className="font-mono">sh -c</code>. Utilise{" "}
              <code className="font-mono">{"{{VARIABLE}}"}</code> pour insérer
              une variable. Vide = comportement par défaut de l&apos;image.
            </p>
          </div>
        )}

        {/* Nom de domaine + affichage du port */}
        <div className="space-y-3 sm:col-span-2">
          <div className="space-y-2">
            <label htmlFor="displayAddress" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-3.5" /> Nom de domaine (optionnel)
            </label>
            <input
              id="displayAddress"
              name="displayAddress"
              type="text"
              placeholder={publicIp}
              data-keep-empty
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Remplace l&apos;IP partout : adresse de connexion et lien SFTP.
              Ton domaine doit pointer sur {publicIp} (enregistrement DNS de
              type A). Vide = l&apos;IP est affichée.
            </p>
          </div>

          <ToggleSwitch
            name="showPort"
            checked={showPort}
            onChange={setShowPort}
            disabled={!canEdit}
            label="Afficher le port dans l'adresse"
            description={`Aperçu : ${previewAddress}`}
          />
        </div>
      </div>

      {canEdit && (
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
