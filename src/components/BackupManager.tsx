"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Archive, Clock, RotateCcw, Trash2 } from "lucide-react";
import {
  createBackupAction,
  deleteBackupAction,
  restoreBackupAction,
  type BackupFormState,
} from "@/lib/servers/backup-actions";
import { formatAge, formatBytes } from "@/lib/k8s/format";

type BackupItem = {
  id: string;
  serverName: string;
  sizeBytes: number;
  note: string | null;
  createdAt: Date;
};

const initial: BackupFormState = {};

export function BackupManager({
  serverId,
  backups,
  limit,
  used,
  canCreate,
  canRestore,
  canDelete,
}: {
  serverId: string;
  backups: BackupItem[];
  limit: number;
  used: number;
  canCreate: boolean;
  canRestore: boolean;
  canDelete: boolean;
}) {
  const [state, action, pending] = useActionState(createBackupAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const full = used >= limit;

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">Sauvegardes</p>
          <p className="text-xs text-muted-foreground">
            {used} / {limit} utilisée{limit > 1 ? "s" : ""}
            {limit === 0 && " — aucune allouée à ce serveur"}
            {full && limit > 0 && " — la prochaine remplacera la plus ancienne"}
          </p>
        </div>
        {canCreate && limit > 0 && (
          <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="serverId" value={serverId} />
            <input
              name="note"
              placeholder="Note (optionnel)"
              data-keep-empty
              maxLength={255}
              className="w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none transition-colors duration-150 focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending}
              title={
                full
                  ? "Limite atteinte : la nouvelle sauvegarde remplacera la plus ancienne."
                  : undefined
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              <Archive className="size-4" aria-hidden />
              {pending ? "Sauvegarde…" : "Créer"}
            </button>
          </form>
        )}
      </div>

      {pending && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Le serveur est arrêté le temps de la sauvegarde, puis redémarré s&apos;il
          tournait. Ne quitte pas la page.
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
          {state.success}
        </p>
      )}

      {backups.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune sauvegarde pour l&apos;instant.
        </p>
      ) : (
        <ul className="space-y-2">
          {backups.map((backup) => (
            <BackupRow
              key={backup.id}
              serverId={serverId}
              backup={backup}
              canRestore={canRestore}
              canDelete={canDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BackupRow({
  serverId,
  backup,
  canRestore,
  canDelete,
}: {
  serverId: string;
  backup: BackupItem;
  canRestore: boolean;
  canDelete: boolean;
}) {
  const [busy, start] = useTransition();
  const [feedback, setFeedback] = useState<BackupFormState>({});
  const [confirmRestore, setConfirmRestore] = useState(false);

  const restore = () =>
    start(async () => setFeedback(await restoreBackupAction(serverId, backup.id)));
  const remove = () =>
    start(async () => setFeedback(await deleteBackupAction(serverId, backup.id)));

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Archive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {backup.note || "Sauvegarde"}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {backup.sizeBytes > 0 ? formatBytes(backup.sizeBytes) : "…"}
            </span>
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {formatAge(backup.createdAt)}
          </p>
        </div>
        {canRestore &&
          (confirmRestore ? (
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-warning bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning transition-colors duration-150 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {busy ? "…" : "Écraser les fichiers actuels ?"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRestore(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Restaurer
            </button>
          ))}
        {canDelete && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label="Supprimer la sauvegarde"
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {feedback.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {feedback.error}
        </p>
      )}
      {feedback.success && (
        <p className="mt-2 text-xs text-success">{feedback.success}</p>
      )}
    </li>
  );
}
