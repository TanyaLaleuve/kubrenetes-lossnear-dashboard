"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Adresse de connexion, en lecture seule avec bouton copier. Le domaine et
 * l'affichage du port se règlent dans Paramètres > Général.
 */
export function ServerAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible (permission navigateur)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Adresse
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate font-mono text-sm">{address}</p>
        <button
          type="button"
          onClick={copy}
          aria-label="Copier l'adresse"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-accent"
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
