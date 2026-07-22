"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

// Séquences ANSI (couleurs, curseur) et caractères de contrôle à masquer.
const ANSI_PATTERN = new RegExp(
  "\\x1b\\[[0-9;?]*[A-Za-z]|\\x1b\\][^\\x07]*\\x07|[\\r\\x00-\\x08\\x0b-\\x1f]",
  "g",
);

const MAX_LINES = 500;

export function ServerConsole({
  serverId,
  running,
  canCommand = true,
}: {
  serverId: string;
  running: boolean;
  canCommand?: boolean;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (!running) return;
    const source = new EventSource(`/api/servers/${serverId}/console`);
    // Reset au (re)branchement : la connexion renvoie déjà l'historique récent.
    source.onopen = () => setLines([]);
    source.onmessage = (event) => {
      const clean = (event.data as string).replace(ANSI_PATTERN, "");
      setLines((prev) => {
        const next = [...prev, clean];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    };
    source.onerror = () => {
      // La connexion se recrée automatiquement (EventSource retry natif).
    };
    return () => source.close();
  }, [serverId, running]);

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const value = command.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/servers/${serverId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Erreur ${response.status}`);
      }
      setCommand("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Console" className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Console</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-[#04070f]">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-72 overflow-y-auto p-3 font-mono text-xs leading-relaxed sm:h-96"
        >
          {!running && (
            <p className="text-muted-foreground">
              Serveur arrêté — démarre-le pour voir la console.
            </p>
          )}
          {running && lines.length === 0 && (
            <p className="text-muted-foreground">Connexion à la console…</p>
          )}
          {lines.map((line, index) =>
            line === "SERVER_LOGS" ? (
              <div
                key={index}
                className="my-2 flex items-center gap-2 text-accent"
              >
                <span className="h-px flex-1 bg-accent/40" />
                <span className="text-[10px] font-semibold tracking-widest uppercase">
                  Logs du serveur
                </span>
                <span className="h-px flex-1 bg-accent/40" />
              </div>
            ) : (
            <div
              key={index}
              className={`break-all whitespace-pre-wrap ${
                line.startsWith("[système]") ? "text-info italic" : ""
              }`}
            >
              {line || " "}
            </div>
            ),
          )}
        </div>
        {canCommand ? (
          <form
            onSubmit={send}
            className="flex items-center gap-2 border-t border-border p-2"
          >
            <span aria-hidden className="pl-1 font-mono text-xs text-accent">
              &gt;
            </span>
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              disabled={!running}
              placeholder={running ? "commande (ex. list, say coucou)" : "serveur arrêté"}
              aria-label="Commande console"
              className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              disabled={!running || sending || !command.trim()}
              aria-label="Envoyer la commande"
              className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-accent disabled:opacity-40"
            >
              <SendHorizontal className="size-4" aria-hidden />
            </button>
          </form>
        ) : (
          <p className="border-t border-border p-2 text-center text-xs text-muted-foreground">
            Lecture seule — pas de permission pour envoyer des commandes.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
