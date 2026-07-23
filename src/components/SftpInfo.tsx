"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Server } from "lucide-react";

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
      <div className="mt-1 flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copier : ${label}`}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-accent"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-accent" aria-hidden />
              Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copier
            </>
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
  // Sans l'identifiant : il est affiché juste en dessous, le lien reste court.
  const url = `sftp://${host}:${port}`;

  return (
    <section
      aria-label="Accès SFTP"
      className="rounded-xl border border-accent/30 bg-accent/5 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Server className="size-4 text-accent" aria-hidden />
        <h2 className="text-sm font-semibold">Accès SFTP</h2>
      </div>

      <div className="space-y-3">
        <CopyField label="Lien SFTP complet" value={url} />
        <CopyField label="Nom d'utilisateur (ce serveur)" value={username} />
        <div>
          <p className="text-xs text-muted-foreground">Mot de passe</p>
          <p className="mt-1 rounded bg-background px-2 py-1.5 text-xs">
            Le mot de passe de <strong>ton compte dashboard</strong> (celui avec
            lequel tu es connecté ici). Chaque personne utilise le sien.
          </p>
        </div>
      </div>

      <a
        href={url}
        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
      >
        <ExternalLink className="size-4" aria-hidden />
        Ouvrir dans l&apos;app SFTP
      </a>

      <p className="mt-3 text-xs text-muted-foreground">
        Le bouton ouvre ton client SFTP par défaut (FileZilla, WinSCP…) s&apos;il
        est associé aux liens <code className="font-mono">sftp://</code>. Sinon,
        copie le lien dans ton client. Compatible aussi avec l&apos;extension SFTP
        de VS Code. Connexion chiffrée, limitée aux fichiers de ce serveur,
        disponible même serveur éteint.
      </p>
    </section>
  );
}
