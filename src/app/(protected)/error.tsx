"use client";

import { TriangleAlert } from "lucide-react";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center">
      <TriangleAlert className="mx-auto size-8 text-destructive" aria-hidden />
      <h2 className="mt-3 font-semibold">Erreur de communication avec le cluster</h2>
      <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-card-hover"
      >
        Réessayer
      </button>
    </div>
  );
}
