"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { scaleDeploymentAction } from "@/lib/k8s/actions";

export function ScaleControl({
  namespace,
  name,
  replicas,
}: {
  namespace: string;
  name: string;
  replicas: number;
}) {
  const [target, setTarget] = useState(replicas);
  const [pending, startTransition] = useTransition();
  const dirty = target !== replicas;

  function apply() {
    startTransition(async () => {
      await scaleDeploymentAction(namespace, name, target);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Réduire les replicas"
        onClick={() => setTarget((n) => Math.max(0, n - 1))}
        disabled={pending || target === 0}
        className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-40"
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span
        className={`min-w-8 text-center font-mono text-sm ${dirty ? "text-warning" : ""}`}
        aria-live="polite"
      >
        {target}
      </span>
      <button
        type="button"
        aria-label="Augmenter les replicas"
        onClick={() => setTarget((n) => Math.min(50, n + 1))}
        disabled={pending}
        className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-40"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
      {dirty && (
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Appliquer"}
        </button>
      )}
    </div>
  );
}
