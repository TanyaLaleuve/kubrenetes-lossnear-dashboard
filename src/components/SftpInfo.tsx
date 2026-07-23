"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Server } from "lucide-react";

function CopyField({
  label,
  value,
  widthCh,
}: {
  label: string;
  value: string;
  /** Largeur imposée, en caractères — voir SftpInfo. */
  widthCh?: number;
}) {
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
      {/* Le bloc de texte s'ajuste au contenu : le bouton copier reste collé à
          sa droite au lieu de partir au bout de la carte. */}
      <div className="mt-1 flex items-center gap-1.5">
        <code
          style={widthCh ? { width: `calc(${widthCh}ch + 1rem)` } : undefined}
          className="min-w-0 max-w-full truncate rounded bg-background px-2 py-1.5 font-mono text-xs"
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copier : ${label}`}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-success"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-success" aria-hidden />
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
  // Les deux champs prennent la largeur du plus long : la police est
  // monospace, donc 1 caractère = 1ch, + 1rem pour le padding horizontal.
  const widthCh = Math.max(url.length, username.length);
  const [noHandler, setNoHandler] = useState(false);

  /**
   * Un lien `sftp://` ne fait rien si aucun logiciel n'est associé au schéma
   * sur la machine, et le navigateur n'affiche aucune erreur. Heuristique
   * classique : si la fenêtre ne perd pas le focus dans la seconde qui suit le
   * clic, c'est qu'aucune application n'a été lancée — on l'explique alors.
   */
  function handleOpen() {
    setNoHandler(false);
    let launched = false;
    const onBlur = () => {
      launched = true;
    };
    window.addEventListener("blur", onBlur, { once: true });
    window.setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!launched) setNoHandler(true);
    }, 1200);
  }

  return (
    <section
      aria-label="Accès SFTP"
      className="rounded-xl border border-success/30 bg-success/5 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Server className="size-4 text-success" aria-hidden />
        <h2 className="text-sm font-semibold">Accès SFTP</h2>
      </div>

      <div className="space-y-3">
        <CopyField label="Lien SFTP complet" value={url} widthCh={widthCh} />
        <CopyField
          label="Nom d'utilisateur (ce serveur)"
          value={username}
          widthCh={widthCh}
        />
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
        onClick={handleOpen}
        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-background transition-opacity duration-150 hover:opacity-90"
      >
        <ExternalLink className="size-4" aria-hidden />
        Ouvrir dans l&apos;app SFTP
      </a>

      {noHandler && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground"
        >
          Rien ne s&apos;est ouvert : aucun logiciel n&apos;est associé aux liens{" "}
          <code className="font-mono">sftp://</code> sur cet appareil. C&apos;est
          normal avec FileZilla, qui n&apos;enregistre pas ce type de lien —
          copie le lien et l&apos;identifiant ci-dessus dans ton client.{" "}
          <strong>WinSCP</strong> (Windows), lui, s&apos;associe aux liens{" "}
          <code className="font-mono">sftp://</code> à l&apos;installation et
          rendra ce bouton fonctionnel.
        </p>
      )}

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
