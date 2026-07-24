"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { adminDeleteBackup, type BackupFormState } from "@/lib/servers/backup-actions";
import { formatAge, formatBytes } from "@/lib/k8s/format";

type Row = {
  id: string;
  serverName: string;
  ownerName: string | null;
  kind: "manual" | "pre_delete";
  sizeBytes: number;
  createdAt: Date;
  orphan: boolean;
};

export function AdminBackupList({ backups }: { backups: Row[] }) {
  if (backups.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucune sauvegarde.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {backups.map((b) => (
        <AdminBackupRow key={b.id} backup={b} />
      ))}
    </ul>
  );
}

function AdminBackupRow({ backup }: { backup: Row }) {
  const [busy, start] = useTransition();
  const [feedback, setFeedback] = useState<BackupFormState>({});
  const [armed, setArmed] = useState(false);

  const remove = () =>
    start(async () => setFeedback(await adminDeleteBackup(backup.id)));

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            backup.kind === "pre_delete"
              ? "bg-warning/15 text-warning"
              : "bg-info/15 text-info"
          }`}
        >
          {backup.kind === "pre_delete" ? "avant suppression" : "manuelle"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {backup.serverName}
            {backup.orphan && (
              <span className="ml-2 text-xs text-muted-foreground">
                (serveur supprimé)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {backup.ownerName ? `${backup.ownerName} · ` : ""}
            {backup.sizeBytes > 0 ? formatBytes(backup.sizeBytes) : "…"} ·{" "}
            {formatAge(backup.createdAt)}
          </p>
        </div>
        <a
          href={`/api/backups/${backup.id}/download`}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <Download className="size-3.5" aria-hidden />
          Télécharger
        </a>
        <button
          type="button"
          onClick={() => (armed ? remove() : setArmed(true))}
          disabled={busy}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
            armed
              ? "border-destructive bg-destructive text-white"
              : "border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive"
          }`}
        >
          <Trash2 className="size-3.5" aria-hidden />
          {busy ? "…" : armed ? "Confirmer" : "Supprimer"}
        </button>
      </div>
      {feedback.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {feedback.error}
        </p>
      )}
    </li>
  );
}
