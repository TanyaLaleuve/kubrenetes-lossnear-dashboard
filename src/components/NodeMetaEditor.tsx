"use client";

import { useActionState } from "react";
import { Pencil } from "lucide-react";
import { updateNodeMeta, type NodeMetaFormState } from "@/lib/nodes/actions";

const initialState: NodeMetaFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors duration-150 focus:border-accent";

const INTERVAL_LABELS: Record<string, string> = {
  hour: "heure",
  month: "mois",
  year: "an",
};

export function NodeMetaEditor({
  nodeName,
  hostingUrl,
  hostingLabel,
  priceCents,
  priceCurrency,
  priceInterval,
}: {
  nodeName: string;
  hostingUrl: string | null;
  hostingLabel: string | null;
  priceCents: number | null;
  priceCurrency: string;
  priceInterval: string | null;
}) {
  const [state, action, pending] = useActionState(updateNodeMeta, initialState);

  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground">
        <Pencil className="size-3 shrink-0" aria-hidden />
        Infos hébergement / coût
        {hostingLabel && (
          <span className="ml-1 truncate text-foreground">— {hostingLabel}</span>
        )}
        {priceCents != null && (
          <span className="ml-auto shrink-0 font-mono text-foreground">
            {(priceCents / 100).toFixed(2)} {priceCurrency}
            {priceInterval ? ` / ${INTERVAL_LABELS[priceInterval]}` : ""}
          </span>
        )}
      </summary>
      <form action={action} className="space-y-2 border-t border-border p-3">
        <input type="hidden" name="nodeName" value={nodeName} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Hébergeur (libellé)
            <input
              name="hostingLabel"
              data-keep-empty
              placeholder="ex. Contabo, Hetzner"
              defaultValue={hostingLabel ?? ""}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Lien vers l&apos;hébergeur
            <input
              name="hostingUrl"
              type="url"
              data-keep-empty
              placeholder="https://…"
              defaultValue={hostingUrl ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Prix ({priceCurrency})
            <input
              name="priceAmount"
              type="number"
              min={0}
              step="0.01"
              data-keep-empty
              placeholder="ex. 39.99"
              defaultValue={priceCents != null ? (priceCents / 100).toFixed(2) : ""}
              className={inputClass}
            />
          </label>
          <label className="col-span-2 space-y-1 text-xs text-muted-foreground sm:col-span-1">
            Par
            <select
              name="priceInterval"
              defaultValue={priceInterval ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="hour">Heure</option>
              <option value="month">Mois</option>
              <option value="year">An</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Informatif uniquement — ne déclenche aucune action (pas de
          facturation réelle).
        </p>
        {state.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-xs text-accent">{state.success}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
      </form>
    </details>
  );
}
