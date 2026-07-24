import { userFromMcpToken } from "@/lib/mcp/tokens";
import { callTool, mcpToolList } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

/**
 * Pont MCP (Model Context Protocol) — transport « Streamable HTTP », sous-
 * ensemble requête/réponse JSON (pas de flux SSE). Permet à l'IA d'un
 * utilisateur (Claude Code / Codex / Gemini, sur SA machine) de piloter ses
 * serveurs. Authentification par jeton personnel ; chaque outil repasse par les
 * permissions serveur du porteur, donc l'IA ne dépasse jamais ses droits.
 */

const PROTOCOL_VERSION = "2025-06-18";

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

export async function POST(request: Request) {
  const token = bearer(request);
  const user = token ? await userFromMcpToken(token) : null;
  if (!user) {
    // 401 + en-tête pour indiquer qu'un jeton Bearer est attendu.
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Jeton MCP invalide ou manquant." },
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "Bearer",
        },
      },
    );
  }

  let body: RpcRequest;
  try {
    body = (await request.json()) as RpcRequest;
  } catch {
    return rpcError(null, -32700, "JSON invalide.");
  }

  const { id, method, params } = body;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion:
          (params?.protocolVersion as string) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "lossnear", version: "1.0.0" },
        instructions:
          "Pont de gestion des serveurs lossnear. Utilise list_servers pour découvrir les serveurs, puis les outils de contrôle/fichiers/console. Chaque action est plafonnée à tes permissions.",
      });

    // Notifications (pas d'id attendu) : on accuse réception sans corps.
    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: mcpToolList() });

    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      const result = await callTool(user, name, args);
      return rpcResult(id, {
        content: [{ type: "text", text: result.text }],
        isError: result.isError ?? false,
      });
    }

    default:
      return rpcError(id, -32601, `Méthode inconnue : ${method}.`);
  }
}

// Le transport « Streamable HTTP » autorise un GET pour ouvrir un flux SSE
// serveur→client. On ne diffuse rien de manière proactive : 405 explicite.
export function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
