import "server-only";
import { eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SafeUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
import { agentFetch, resolveVolumeDir } from "@/lib/servers/files";
import { execInServer, sendConsoleCommand } from "@/lib/servers/exec";
import { setReplicas, forceDeletePod } from "@/lib/servers/k8s";
import { serverRuntimeStatus } from "@/lib/servers/k8s";

/**
 * Outils MCP exposés à l'IA d'un utilisateur. Chaque exécution repasse par les
 * permissions serveur du porteur du jeton (via serverAccess), donc l'IA ne peut
 * jamais dépasser les droits de l'humain. Le shell brut est réservé au
 * propriétaire/admin (privileged) car il court-circuite les permissions fines.
 */

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ToolResult = { text: string; isError?: boolean };

// Schéma JSON minimal réutilisable.
const S = {
  server: {
    type: "string",
    description: "Identifiant court du serveur (voir list_servers).",
  },
  path: { type: "string", description: "Chemin relatif dans le serveur." },
};

/** Catalogue complet, filtré ensuite selon les permissions du user + du serveur. */
const ALL_TOOLS: (McpTool & { perm: string | "privileged" | "any" })[] = [
  {
    name: "list_servers",
    description:
      "Liste les serveurs accessibles (les tiens + ceux où tu es invité) avec leur statut.",
    perm: "any",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "server_status",
    description: "Statut détaillé d'un serveur (état, image, ressources).",
    perm: "any",
    inputSchema: {
      type: "object",
      properties: { server: S.server },
      required: ["server"],
    },
  },
  {
    name: "start_server",
    description: "Démarre un serveur.",
    perm: "control.start",
    inputSchema: {
      type: "object",
      properties: { server: S.server },
      required: ["server"],
    },
  },
  {
    name: "stop_server",
    description: "Arrête un serveur.",
    perm: "control.stop",
    inputSchema: {
      type: "object",
      properties: { server: S.server },
      required: ["server"],
    },
  },
  {
    name: "restart_server",
    description: "Redémarre un serveur (recrée le conteneur).",
    perm: "control.restart",
    inputSchema: {
      type: "object",
      properties: { server: S.server },
      required: ["server"],
    },
  },
  {
    name: "send_command",
    description: "Envoie une commande à la console du serveur (stdin du process).",
    perm: "console.command",
    inputSchema: {
      type: "object",
      properties: { server: S.server, command: { type: "string" } },
      required: ["server", "command"],
    },
  },
  {
    name: "read_logs",
    description: "Lit les dernières lignes de logs du serveur.",
    perm: "console.read",
    inputSchema: {
      type: "object",
      properties: {
        server: S.server,
        lines: { type: "number", description: "Nombre de lignes (défaut 100)." },
      },
      required: ["server"],
    },
  },
  {
    name: "list_files",
    description: "Liste un dossier du serveur.",
    perm: "files.read",
    inputSchema: {
      type: "object",
      properties: { server: S.server, path: S.path },
      required: ["server"],
    },
  },
  {
    name: "read_file",
    description: "Lit le contenu texte d'un fichier du serveur.",
    perm: "files.read",
    inputSchema: {
      type: "object",
      properties: { server: S.server, path: S.path },
      required: ["server", "path"],
    },
  },
  {
    name: "write_file",
    description:
      "Écrit (crée ou remplace) un fichier du serveur. Sert aussi à l'upload : fournis le contenu.",
    perm: "files.write",
    inputSchema: {
      type: "object",
      properties: {
        server: S.server,
        path: S.path,
        content: { type: "string", description: "Contenu texte du fichier." },
      },
      required: ["server", "path", "content"],
    },
  },
  {
    name: "delete_path",
    description: "Supprime un fichier ou dossier du serveur.",
    perm: "files.delete",
    inputSchema: {
      type: "object",
      properties: { server: S.server, path: S.path },
      required: ["server", "path"],
    },
  },
  {
    name: "run_shell",
    description:
      "Exécute une commande shell DANS le conteneur du serveur (serveur démarré requis). Accès complet au conteneur, réservé au propriétaire.",
    perm: "privileged",
    inputSchema: {
      type: "object",
      properties: {
        server: S.server,
        command: { type: "string", description: "Commande sh -c à exécuter." },
      },
      required: ["server", "command"],
    },
  },
];

/**
 * Catalogue d'outils exposé au client MCP. On liste tous les outils ; le droit
 * réel est revérifié à chaque appel, serveur par serveur (un même utilisateur
 * peut être admin sur un serveur et lecteur sur un autre).
 */
export function mcpToolList(): McpTool[] {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

type Guard =
  | { ok: true; access: NonNullable<Awaited<ReturnType<typeof serverAccess>>> }
  | { ok: false; error: string };

/** Accès + permission au serveur cité, en exigeant AUSSI ai.use. */
async function accessForTool(
  user: SafeUser,
  ref: string,
  perm: string,
): Promise<Guard> {
  const access = await serverAccess(user, ref);
  if (!access) return { ok: false, error: "Serveur introuvable ou inaccessible." };
  if (!access.permissions.has("ai.use")) {
    return { ok: false, error: "L'accès IA n'est pas activé pour toi sur ce serveur." };
  }
  if (perm === "any") return { ok: true, access };
  if (perm === "privileged") {
    if (!access.privileged) {
      return { ok: false, error: "Réservé au propriétaire du serveur." };
    }
    return { ok: true, access };
  }
  if (!access.permissions.has(perm)) {
    return { ok: false, error: `Permission manquante : ${perm}.` };
  }
  return { ok: true, access };
}

/** Exécute un outil MCP. Renvoie un texte (résultat ou message d'erreur). */
export async function callTool(
  user: SafeUser,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) return { text: `Outil inconnu : ${name}.`, isError: true };

  // list_servers ne cible pas un serveur précis.
  if (name === "list_servers") {
    const rows = await db()
      .select({
        shortId: schema.servers.shortId,
        name: schema.servers.name,
        image: schema.servers.image,
        state: schema.servers.desiredState,
      })
      .from(schema.servers)
      .leftJoin(
        schema.serverMembers,
        eq(schema.serverMembers.serverId, schema.servers.id),
      )
      .where(
        user.isAdmin
          ? undefined
          : or(
              eq(schema.servers.ownerId, user.id),
              eq(schema.serverMembers.userId, user.id),
            ),
      );
    const seen = new Map(rows.map((r) => [r.shortId, r]));
    const list = [...seen.values()];
    if (list.length === 0) return { text: "Aucun serveur accessible." };
    return {
      text: list
        .map((s) => `- ${s.shortId} — ${s.name} (${s.image}) : ${s.state}`)
        .join("\n"),
    };
  }

  const ref = String(args.server ?? "");
  const guard = await accessForTool(user, ref, tool.perm);
  if (!guard.ok) return { text: guard.error, isError: true };
  const { server } = guard.access;

  try {
    switch (name) {
      case "server_status": {
        const status = await serverRuntimeStatus(server).catch(() => null);
        return {
          text: [
            `Serveur : ${server.name} (${server.shortId})`,
            `Image : ${server.image}`,
            `État souhaité : ${server.desiredState}`,
            `Statut réel : ${status?.label ?? "inconnu"}`,
            `Ressources : ${server.memoryMi} Mio RAM, ${server.cpuMilli}m CPU, ${server.diskGi} Gio disque`,
          ].join("\n"),
        };
      }
      case "start_server":
        await setReplicas(server.slug, 1);
        await db()
          .update(schema.servers)
          .set({ desiredState: "running", updatedAt: new Date() })
          .where(eq(schema.servers.id, server.id));
        return { text: `Serveur ${server.name} démarré.` };
      case "stop_server":
        await db()
          .update(schema.servers)
          .set({ desiredState: "stopped", updatedAt: new Date() })
          .where(eq(schema.servers.id, server.id));
        await setReplicas(server.slug, 0);
        return { text: `Serveur ${server.name} arrêté.` };
      case "restart_server":
        await forceDeletePod(server.slug);
        return { text: `Serveur ${server.name} redémarré.` };
      case "send_command": {
        const command = String(args.command ?? "");
        try {
          await sendConsoleCommand(server.slug, command);
        } catch {
          return {
            text: "Console injoignable (serveur arrêté ?).",
            isError: true,
          };
        }
        return { text: `Commande envoyée : ${command}` };
      }
      case "read_logs": {
        const lines = Math.min(Number(args.lines ?? 100) || 100, 500);
        const { getPodLogs } = await import("@/lib/k8s/resources");
        const logs = await getPodLogs(
          "lossnear-servers",
          `${server.slug}-0`,
          "server",
          lines,
        ).catch(() => "");
        return { text: logs || "(aucun log — le serveur tourne-t-il ?)" };
      }
      case "list_files": {
        const res = await agentFetch(
          "/files/list",
          await volOf(server.slug),
          String(args.path ?? ""),
        );
        const data = await res.json();
        if (!res.ok) return { text: data.error ?? "Erreur.", isError: true };
        const items = (data.items ?? []) as {
          name: string;
          dir: boolean;
          size: number;
        }[];
        return {
          text:
            items
              .map((i) => `${i.dir ? "d" : "-"} ${i.name}${i.dir ? "/" : ` (${i.size} o)`}`)
              .join("\n") || "(dossier vide)",
        };
      }
      case "read_file": {
        const res = await agentFetch(
          "/files/read",
          await volOf(server.slug),
          String(args.path ?? ""),
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { text: data.error ?? "Erreur de lecture.", isError: true };
        }
        const text = await res.text();
        return { text };
      }
      case "write_file": {
        const res = await agentFetch(
          "/files/write",
          await volOf(server.slug),
          String(args.path ?? ""),
          { method: "POST", body: String(args.content ?? "") },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { text: data.error ?? "Erreur d'écriture.", isError: true };
        }
        return { text: `Fichier écrit : ${args.path}` };
      }
      case "delete_path": {
        const res = await agentFetch(
          "/files/delete",
          await volOf(server.slug),
          String(args.path ?? ""),
          { method: "POST" },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { text: data.error ?? "Erreur de suppression.", isError: true };
        }
        return { text: `Supprimé : ${args.path}` };
      }
      case "run_shell": {
        const command = String(args.command ?? "");
        const result = await execInServer(server.slug, command);
        return {
          text: [
            `$ ${command}`,
            result.stdout,
            result.stderr ? `[stderr]\n${result.stderr}` : "",
            `[code ${result.exitCode}]`,
          ]
            .filter(Boolean)
            .join("\n"),
          isError: result.exitCode !== 0,
        };
      }
      default:
        return { text: `Outil non implémenté : ${name}.`, isError: true };
    }
  } catch (error) {
    return {
      text: error instanceof Error ? error.message : "Erreur interne.",
      isError: true,
    };
  }
}

async function volOf(slug: string): Promise<string> {
  const vol = await resolveVolumeDir(slug);
  if (!vol) throw new Error("Volume indisponible : démarre le serveur une fois.");
  return vol;
}
