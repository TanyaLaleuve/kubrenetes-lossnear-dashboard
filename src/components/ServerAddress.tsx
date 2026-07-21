"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import {
  updateServerAddress,
  type ServerFormState,
} from "@/lib/servers/actions";

const initialState: ServerFormState = {};

export function ServerAddress({
  serverId,
  address,
  fallback,
}: {
  serverId: string;
  /** Adresse custom (domaine) ou null. */
  address: string | null;
  /** IP:port réel, utilisé si pas d'adresse custom. */
  fallback: string;
}) {
  const shown = address || fallback;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: ServerFormState, formData: FormData) => {
      const result = await updateServerAddress(prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    initialState,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
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
      {!editing ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate font-mono text-sm">{shown}</p>
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
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Modifier l'adresse affichée"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <form action={action} className="mt-1.5 space-y-2">
          <input type="hidden" name="serverId" value={serverId} />
          <input
            name="displayAddress"
            defaultValue={address ?? ""}
            placeholder={fallback}
            aria-label="Adresse affichée (domaine)"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-sm outline-none transition-colors duration-150 focus:border-accent"
          />
          <p className="text-xs text-muted-foreground">
            Domaine affiché aux joueurs (laisser vide pour l&apos;IP). Pense au
            DNS : enregistrement A ou SRV vers {fallback}.
          </p>
          {state.error && (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
