"use client";

import { useActionState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  deleteServer,
  forceDeleteServer,
  migrateServerAction,
  reinstallServerAction,
  updateServerNetworkAction,
  type ServerFormState,
} from "@/lib/servers/actions";
import {
  updateServerBackupLimitAction,
  type BackupFormState,
} from "@/lib/servers/backup-actions";
import type { Server as ServerType } from "@/lib/db/schema";

type NodeOption = {
  name: string;
  ready: boolean;
};

export function ServerManagementForm({
  server,
  nodes,
  canManage,
  isPrivileged,
  canOpenNetwork,
  backupsEnabled,
  backupRemaining,
}: {
  server: ServerType;
  nodes: NodeOption[];
  /** Peut réinstaller/migrer (settings.manage ou privilégié). */
  canManage: boolean;
  /** Propriétaire/admin uniquement : seul habilité à supprimer le serveur. */
  isPrivileged: boolean;
  /** Permission servers.network_open : lever le cloisonnement réseau. */
  canOpenNetwork: boolean;
  /** Le propriétaire a-t-il le droit de faire des sauvegardes ? */
  backupsEnabled: boolean;
  /** Sauvegardes encore attribuables (quota total - déjà réparti ailleurs). */
  backupRemaining: number;
}) {
  const [reinstallState, reinstallAction, reinstallPending] = useActionState<
    ServerFormState,
    FormData
  >(reinstallServerAction, {});

  const [migrateState, migrateAction, migratePending] = useActionState<
    ServerFormState,
    FormData
  >(migrateServerAction, {});

  const [networkState, networkAction, networkPending] = useActionState<
    ServerFormState,
    FormData
  >(updateServerNetworkAction, {});

  const [backupState, backupAction, backupPending] = useActionState<
    BackupFormState,
    FormData
  >(updateServerBackupLimitAction, {});

  return (
    <div className="space-y-6">
      {/* 1. Réinstallation du serveur */}
      <section aria-label="Réinstallation" className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <RefreshCw className="size-5 text-amber-500" /> Réinstallation du serveur
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rejoue le script d&apos;installation de l&apos;Egg et réinitialise les fichiers système tout en conservant le disque de stockage.
          </p>
        </div>

        {reinstallState.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
            {reinstallState.error}
          </div>
        )}

        {reinstallState.success && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
            {reinstallState.success}
          </div>
        )}

        <form action={reinstallAction} className="flex items-center justify-between pt-2 border-t border-border">
          <input type="hidden" name="serverId" value={server.id} />
          <div className="text-xs text-muted-foreground">
            {server.installScript
              ? "Un script d'installation est configuré pour cet egg."
              : "Aucun script d'installation spécifique, le conteneur sera simplement redémarré à neuf."}
          </div>

          {canManage && (
            <button
              type="submit"
              disabled={reinstallPending}
              onClick={(e) => {
                if (!confirm("Voulez-vous vraiment réinstaller ce serveur ? Le serveur sera redémarré.")) {
                  e.preventDefault();
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`size-4 ${reinstallPending ? "animate-spin" : ""}`} />
              {reinstallPending ? "Réinstallation..." : "Réinstaller le serveur"}
            </button>
          )}
        </form>
      </section>

      {/* 2. Migration vers un autre nœud (Node K8s) */}
      <section aria-label="Migration" className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-accent" /> Migration de serveur (Nœud K8s)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Déplacez l&apos;exécution du pod de ce serveur sur un autre nœud physique de votre cluster Kubernetes.
          </p>
        </div>

        {migrateState.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
            {migrateState.error}
          </div>
        )}

        {migrateState.success && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
            {migrateState.success}
          </div>
        )}

        <form action={migrateAction} className="space-y-4 pt-2 border-t border-border">
          <input type="hidden" name="serverId" value={server.id} />

          <div className="space-y-2">
            <label htmlFor="nodeName" className="text-xs font-medium text-muted-foreground">
              Nœud Kubernetes cible
            </label>
            {/* name="node" et non "nodeName" : ce dernier masque form.nodeName. */}
            <select
              id="nodeName"
              name="node"
              defaultValue={server.nodeName ?? "auto"}
              disabled={!canManage}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
            >
              <option value="auto">Assignation automatique par le Scheduler K8s (Default)</option>
              {nodes.map((n) => (
                <option key={n.name} value={n.name}>
                  Nœud: {n.name} {n.ready ? "(Prêt)" : "(Non prêt)"}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Nœud actuellement assigné : <span className="font-mono text-foreground">{server.nodeName || "Automatique"}</span>
            </p>
          </div>

          {canManage && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={migratePending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                <ArrowRightLeft className="size-4" />
                {migratePending ? "Migration en cours..." : "Migrer le serveur"}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* 3. Cloisonnement réseau */}
      <section aria-label="Réseau" className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-5 text-success" /> Cloisonnement réseau
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Un serveur cloisonné ne joint qu&apos;Internet. Il ne peut pas
            atteindre le réseau interne : base de données, agent de fichiers,
            API Kubernetes, autres serveurs, services de la machine hôte.
          </p>
        </div>

        {networkState.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
            {networkState.error}
          </div>
        )}

        {networkState.success && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
            {networkState.success}
          </div>
        )}

        <form action={networkAction} className="space-y-4 pt-2 border-t border-border">
          <input type="hidden" name="serverId" value={server.id} />

          <ToggleSwitch
            name="isolated"
            defaultChecked={server.isolated}
            disabled={!canOpenNetwork}
            label="Cloisonner ce serveur (recommandé)"
            description={
              canOpenNetwork
                ? "Décocher n'est justifié que pour un serveur de confiance qui doit joindre un service interne."
                : "Tu n'as pas la permission de lever le cloisonnement."
            }
          />

          {!server.isolated && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              Ce serveur n&apos;est pas cloisonné : un programme qui y tourne
              peut atteindre tout le réseau interne.
            </p>
          )}

          {canOpenNetwork && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={networkPending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                <ShieldCheck className="size-4" />
                {networkPending ? "Application..." : "Enregistrer"}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* 4. Allocation de sauvegardes (propriétaire, si autorisé) */}
      {isPrivileged && backupsEnabled && (
        <section aria-label="Sauvegardes" className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Archive className="size-5 text-accent" /> Sauvegardes allouées
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Nombre de sauvegardes que ce serveur peut conserver, pris sur ton
              quota total. Encore attribuable ailleurs : {backupRemaining}.
            </p>
          </div>

          {backupState.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
              {backupState.error}
            </div>
          )}
          {backupState.success && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
              {backupState.success}
            </div>
          )}

          <form action={backupAction} className="flex flex-wrap items-end gap-3 pt-2 border-t border-border">
            <input type="hidden" name="serverId" value={server.id} />
            <div className="space-y-1">
              <label htmlFor="backupLimit" className="text-xs font-medium text-muted-foreground">
                Sauvegardes pour ce serveur
              </label>
              <input
                id="backupLimit"
                name="backupLimit"
                type="number"
                min={0}
                max={backupRemaining}
                defaultValue={server.backupLimit}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={backupPending}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              <Archive className="size-4" />
              {backupPending ? "..." : "Enregistrer"}
            </button>
          </form>
        </section>
      )}

      {/* 5. Zone Dangereuse / Suppression */}
      {isPrivileged && (
        <section aria-label="Zone dangereuse" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" /> Zone dangereuse
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Actions irréversibles sur ce serveur.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-destructive/20">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Supprimer le serveur</p>
              <p className="text-xs text-muted-foreground">
                Une sauvegarde de secours est prise automatiquement avant la
                destruction (accessible aux admins du site). Le StatefulSet, le
                service et le disque sont ensuite détruits.
              </p>
            </div>

            <ConfirmButton
              action={deleteServer.bind(null, server.id)}
              confirmLabel="Oui, supprimer (avec sauvegarde)"
            >
              <Trash2 className="size-4 mr-1.5" />
              Supprimer le serveur
            </ConfirmButton>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-destructive/20">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Forcer la suppression</p>
              <p className="text-xs text-muted-foreground">
                Supprime sans sauvegarde de secours. Plus rapide, mais aucune
                récupération possible ensuite.
              </p>
            </div>

            <ConfirmButton
              action={forceDeleteServer.bind(null, server.id)}
              confirmLabel="Oui, supprimer sans sauvegarde"
            >
              <Trash2 className="size-4 mr-1.5" />
              Forcer la suppression
            </ConfirmButton>
          </div>
        </section>
      )}
    </div>
  );
}
