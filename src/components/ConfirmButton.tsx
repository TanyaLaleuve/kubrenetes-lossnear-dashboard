"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bouton destructif en deux temps : premier tap arme la confirmation,
 * second tap (dans les 3 s) exécute l'action. Évite les modales sur mobile.
 */
export function ConfirmButton({
  action,
  children,
  confirmLabel = "Confirmer ?",
  className = "",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handleClick() {
    if (busy) return;
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-live="polite"
      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
        armed
          ? "border-destructive bg-destructive text-white"
          : "border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive"
      } ${className}`}
    >
      {busy ? "…" : armed ? confirmLabel : children}
    </button>
  );
}
