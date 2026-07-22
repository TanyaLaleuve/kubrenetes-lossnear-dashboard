"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible
    }
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copier ${label}`}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground hover:bg-card-hover hover:text-accent"
        >
          {copied ? (
            <Check className="size-3.5 text-accent" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

export function SftpInfo({
  host,
  port,
  username,
}: {
  host: string;
  port: number;
  username: string;
}) {
  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
        Accès SFTP
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CopyField label="Hôte" value={host} />
        <CopyField label="Port" value={String(port)} />
        <CopyField label="Utilisateur" value={username} />
        <div>
          <p className="text-xs text-muted-foreground">Mot de passe</p>
          <p className="mt-0.5 rounded bg-background px-2 py-1 text-xs">
            Ton mot de passe du dashboard.
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Compatible FileZilla, WinSCP, l&apos;extension SFTP de VS Code, etc.
        Connexion chiffrée, limitée aux fichiers de ce serveur.
      </p>
    </details>
  );
}
