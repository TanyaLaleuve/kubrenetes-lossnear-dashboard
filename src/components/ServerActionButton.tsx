"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const variantClasses = {
  accent: "bg-accent text-accent-foreground hover:opacity-90",
  outline:
    "border border-border text-muted-foreground hover:bg-card-hover hover:text-foreground",
  destructive:
    "border border-destructive/40 text-destructive hover:bg-destructive hover:text-white",
} as const;

export function ServerActionButton({
  action,
  children,
  variant = "outline",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  variant?: keyof typeof variantClasses;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        // Rafraîchit immédiatement l'état (badge, boutons) sans attendre le
        // rafraîchissement auto de 10 s.
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action impossible.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${variantClasses[variant]}`}
      >
        {pending ? "…" : children}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-[11px] text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
