"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import { checkPortAvailability } from "@/lib/servers/actions";

type Result = { port: number; ok: boolean; warning?: boolean; message: string };

/**
 * Vérifie la disponibilité d'un port externe et affiche le verdict.
 * `serverId` : le port actuel de ce serveur n'est pas compté comme conflit.
 */
export function PortCheck({
  port,
  serverId,
}: {
  port: string;
  serverId?: string;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [, start] = useTransition();

  const value = Number(port);
  const valid = port.trim() !== "" && Number.isInteger(value) && value > 0;

  useEffect(() => {
    if (!valid) return;
    // Anti-rebond : on ne teste qu'après une courte pause de frappe.
    const timer = setTimeout(() => {
      start(async () => {
        const res = await checkPortAvailability(value, serverId);
        setResult({ port: value, ...res });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [valid, value, serverId]);

  if (!valid) return null;
  // Le résultat n'est affiché que s'il correspond au port saisi actuellement.
  if (!result || result.port !== value) {
    return <p className="text-[11px] text-muted-foreground">Vérification…</p>;
  }

  const tone = !result.ok
    ? "text-destructive"
    : result.warning
      ? "text-warning"
      : "text-accent";

  return (
    <p className={`flex items-start gap-1 text-[11px] ${tone}`} role="status">
      {!result.ok ? (
        <X className="mt-px size-3.5 shrink-0" aria-hidden />
      ) : result.warning ? (
        <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      ) : (
        <Check className="mt-px size-3.5 shrink-0" aria-hidden />
      )}
      {result.message}
    </p>
  );
}
