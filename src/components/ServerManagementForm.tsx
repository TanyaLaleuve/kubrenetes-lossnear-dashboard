"use client";

import { useActionState } from "react";
import { AlertTriangle, ArrowRightLeft, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  deleteServer,
  migrateServerAction,
  reinstallServerAction,
  type ServerFormState,
} from "@/lib/servers/actions";
import type { Server as ServerType } from "@/lib/db/schema";

type NodeOption = {
  name: string;
  ready: boolean;
};

export function ServerManagementForm({
  server,
  nodes,
  isPrivileged,
}: {
  server: ServerType;
  nodes: NodeOption[];
  isPrivileged: boolean;
}) {
  const [reinstallState, reinstallAction, reinstallPending] = useActionState<
    ServerFormState,
    FormData
  >(reinstallServerAction, {});

  const [migrateState, migrateAction, migratePending] = useActionState<
    ServerFormState,
    FormData
  >(migrateServerAction, {});

  return (
    <div className="space-y-6">
      {/* 1. Réinstallation du serveur */}
      <section aria-label="Réinstallation" className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <RefreshCw className="size-5 text-amber-500" /> Réinstallation du serveur
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rejoue le script d'installation de l'Egg et réinitialise les fichiers système tout en conservant le disque de stockage.
          </p>
        </div>

        {reinstallState.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
            {reinstallState.error}
          </div>
        )}

        <form action={reinstallAction} className="flex items-center justify-between pt-2 border-t border-border">
          <input type="hidden" name="serverId" value={server.id} />
          <div className="text-xs text-muted-foreground">
            {server.installScript
              ? "Un script d'installation est configuré pour cet egg."
              : "Aucun script d'installation spécifique, le conteneur sera simplement redémarré à neuf."}
          </div>

          {isPrivileged && (
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
            Déplacez l'exécution du pod de ce serveur sur un autre nœud physique de votre cluster Kubernetes.
          </p>
        </div>

        {migrateState.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
            {migrateState.error}
          </div>
        )}

        <form action={migrateAction} className="space-y-4 pt-2 border-t border-border">
          <input type="hidden" name="serverId" value={server.id} />

          <div className="space-y-2">
            <label htmlFor="nodeName" className="text-xs font-medium text-muted-foreground">
              Nœud Kubernetes cible
            </label>
            <select
              id="nodeName"
              name="nodeName"
              defaultValue={server.nodeName ?? "auto"}
              disabled={!isPrivileged}
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

          {isPrivileged && (
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

      {/* 3. Zone Dangereuse / Suppression */}
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

          <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
            <div>
              <p className="text-sm font-medium text-foreground">Supprimer le serveur</p>
              <p className="text-xs text-muted-foreground">
                Cette action détruira définitivement le StatefulSet, le service et le disque de données.
              </p>
            </div>

            <ConfirmButton
              action={deleteServer.bind(null, server.id)}
              confirmLabel="Oui, supprimer définitivement"
            >
              <Trash2 className="size-4 mr-1.5" />
              Supprimer le serveur
            </ConfirmButton>
          </div>
        </section>
      )}
    </div>
  );
}
