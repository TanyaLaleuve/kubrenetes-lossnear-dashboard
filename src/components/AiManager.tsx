"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  createMcpTokenAction,
  revokeMcpTokenAction,
  type McpTokenState,
} from "@/lib/mcp/actions";
import { formatAge } from "@/lib/k8s/format";

type TokenRow = {
  id: string;
  prefix: string;
  label: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

const MCP_URL = "https://k8s.lossnear.com/api/mcp";

export function AiManager({
  tokens,
  shellAllowed,
}: {
  tokens: TokenRow[];
  /** Le user est-il propriétaire/admin de CE serveur (accès shell complet) ? */
  shellAllowed: boolean;
}) {
  const [state, action, pending] = useActionState<McpTokenState, FormData>(
    createMcpTokenAction,
    {},
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">Piloter ce serveur avec une IA</h2>
        <p className="text-sm text-muted-foreground">
          Connecte ton assistant (Claude Code, Claude Desktop, Codex, Gemini) à
          ce dashboard. L&apos;IA tourne sur <strong>ta</strong> machine ; elle
          ne peut rien faire que tu ne puisses faire toi-même, et ne peut jamais
          sortir du conteneur du serveur.
        </p>
        <p className="text-xs text-muted-foreground">
          Portée de ton accès sur ce serveur :{" "}
          {shellAllowed ? (
            <span className="text-success">
              complet (fichiers, console, contrôle, shell).
            </span>
          ) : (
            <span>limité à tes permissions ; le shell est réservé au propriétaire.</span>
          )}
        </p>
      </section>

      {/* Création d'un jeton */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-accent" aria-hidden />
          Jetons d&apos;accès
        </h3>
        <p className="text-xs text-muted-foreground">
          Un jeton relie ton IA à ton compte. Il donne accès à{" "}
          <strong>tous</strong> tes serveurs où l&apos;IA est activée, toujours
          plafonné à tes permissions. Ne le partage pas.
        </p>

        {state.token ? (
          <RevealToken token={state.token} shellAllowed={shellAllowed} />
        ) : (
          <form action={action} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="label" className="text-xs text-muted-foreground">
                Nom du jeton (optionnel)
              </label>
              <input
                id="label"
                name="label"
                placeholder="ex. Claude sur mon PC"
                data-keep-empty
                maxLength={64}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden />
              {pending ? "…" : "Générer un jeton"}
            </button>
            {state.error && (
              <p role="alert" className="w-full text-sm text-destructive">
                {state.error}
              </p>
            )}
          </form>
        )}

        {tokens.length > 0 && (
          <ul className="divide-y divide-border">
            {tokens.map((t) => (
              <TokenRowItem key={t.id} token={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RevealToken({ token, shellAllowed }: { token: string; shellAllowed: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
        <TriangleAlert className="size-3.5" aria-hidden />
        Copie ce jeton maintenant : il ne sera plus jamais affiché.
      </p>
      <CopyBox label="Jeton" value={token} />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Claude Code (une commande)
        </p>
        <CopyBox
          label="Commande"
          value={`claude mcp add --transport http lossnear ${MCP_URL} --header "Authorization: Bearer ${token}"`}
        />
        <p className="text-xs font-medium text-muted-foreground">
          Claude Desktop / Codex / Gemini (config JSON)
        </p>
        <CopyBox
          label="Config"
          value={JSON.stringify(
            {
              mcpServers: {
                lossnear: {
                  type: "http",
                  url: MCP_URL,
                  headers: { Authorization: `Bearer ${token}` },
                },
              },
            },
            null,
            2,
          )}
          multiline
        />
      </div>
      {shellAllowed && (
        <p className="text-xs text-muted-foreground">
          Demande par exemple à ton IA : « démarre mon serveur », « montre les
          logs », « installe ce plugin dans plugins/ ».
        </p>
      )}
    </div>
  );
}

function TokenRowItem({ token }: { token: TokenRow }) {
  const [busy, start] = useTransition();
  const [armed, setArmed] = useState(false);
  return (
    <li className="flex items-center gap-3 py-2">
      <code className="rounded bg-background px-2 py-1 font-mono text-xs">
        {token.prefix}…
      </code>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{token.label || "Jeton"}</p>
        <p className="text-xs text-muted-foreground">
          créé {formatAge(token.createdAt)}
          {token.lastUsedAt ? ` · utilisé ${formatAge(token.lastUsedAt)}` : " · jamais utilisé"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => (armed ? start(async () => revokeMcpTokenAction(token.id)) : setArmed(true))}
        disabled={busy}
        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
          armed
            ? "border-destructive bg-destructive text-white"
            : "border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive"
        }`}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {busy ? "…" : armed ? "Confirmer" : "Révoquer"}
      </button>
    </li>
  );
}

function CopyBox({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible
    }
  }
  return (
    <div className="flex items-start gap-1.5">
      <pre
        className={`min-w-0 flex-1 overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-xs ${
          multiline ? "whitespace-pre" : "truncate"
        }`}
      >
        {value}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copier : ${label}`}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-accent"
      >
        {copied ? (
          <Check className="size-3.5 text-accent" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
