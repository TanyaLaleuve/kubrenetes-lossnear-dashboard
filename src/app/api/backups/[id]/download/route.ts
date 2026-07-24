import { eq } from "drizzle-orm";
import { sessionUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Téléchargement d'une archive de sauvegarde. Réservé aux admins du site : les
 * sauvegardes pre_delete (avant suppression) ne doivent jamais être accessibles
 * aux propriétaires. Proxifie le flux depuis l'agent de nœud.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await sessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (!user.isAdmin) return new Response(null, { status: 403 });

  const { id } = await params;
  const [backup] = await db()
    .select()
    .from(schema.backups)
    .where(eq(schema.backups.id, id))
    .limit(1);
  if (!backup) return new Response(null, { status: 404 });

  const token = env().AGENT_TOKEN;
  if (!token) return new Response("Agent non configuré", { status: 500 });

  const url = new URL("/backup/download", env().AGENT_URL);
  url.searchParams.set("slug", backup.serverSlug);
  url.searchParams.set("id", backup.id);

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Archive indisponible", { status: 502 });
  }

  const filename = `${backup.serverName}-${backup.id}.tar.gz`.replace(/[^\w.-]+/g, "_");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
