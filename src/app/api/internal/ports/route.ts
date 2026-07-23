import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Liste des ports externes actuellement attribués à des serveurs.
 * Consommée par le synchroniseur de pare-feu de l'hôte (systemd timer) pour
 * ouvrir/fermer automatiquement les ports dans ufw. Jamais exposée
 * publiquement : protégée par le token partagé AGENT_TOKEN.
 *
 * Réponse en texte brut (un port par ligne) pour rester lisible sans jq.
 */
export async function GET(request: Request) {
  const token = env().AGENT_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) {
    return new Response("unauthorized\n", { status: 401 });
  }

  const rows = await db()
    .select({ hostPort: schema.servers.hostPort })
    .from(schema.servers);
  const ports = [...new Set(rows.map((r) => r.hostPort))].sort((a, b) => a - b);

  return new Response(ports.join("\n") + (ports.length ? "\n" : ""), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
