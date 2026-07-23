"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { checkPortAvailability } from "@/lib/servers/actions";

type Result = { port: number; ok: boolean; message: string };

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

  return (
    <p
      className={`flex items-center gap-1 text-[11px] ${
        result.ok ? "text-accent" : "text-destructive"
      }`}
      role="status"
    >
      {result.ok ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <X className="size-3.5" aria-hidden />
      )}
      {result.message}
    </p>
  );
}
