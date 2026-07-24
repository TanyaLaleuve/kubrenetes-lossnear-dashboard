import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { resolveVolumeDir } from "./files";

/**
 * Appel à l'agent pour une opération de sauvegarde. Les backups sont des
 * archives tar.gz du volume, stockées par l'agent sous un chemin dédié du nœud.
 */
async function agentBackup(
  path: string,
  params: Record<string, string>,
): Promise<Response> {
  const token = env().AGENT_TOKEN;
  if (!token) throw new Error("Agent de nœud non configuré (AGENT_TOKEN manquant).");
  const url = new URL(path, env().AGENT_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

/** Demande à l'agent d'archiver le volume. Renvoie la taille de l'archive. */
export async function agentCreateArchive(
  slug: string,
  backupId: string,
): Promise<number> {
  const vol = await resolveVolumeDir(slug);
  if (!vol) throw new Error("Volume introuvable : le serveur n'a jamais démarré.");
  const res = await agentBackup("/backup/create", { vol, slug, id: backupId });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 507) {
      throw new Error(
        "Espace disque insuffisant sur le nœud pour créer une sauvegarde.",
      );
    }
    throw new Error(body.error || "Échec de la création de l'archive.");
  }
  const data = (await res.json()) as { size?: number };
  return data.size ?? 0;
}

/** Restaure une archive dans le volume (destructif). */
export async function agentRestoreArchive(
  slug: string,
  backupId: string,
): Promise<void> {
  const vol = await resolveVolumeDir(slug);
  if (!vol) throw new Error("Volume introuvable.");
  const res = await agentBackup("/backup/restore", { vol, slug, id: backupId });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Échec de la restauration.");
  }
}

/** Supprime l'archive sur le disque du nœud (idempotent). */
export async function agentDeleteArchive(
  slug: string,
  backupId: string,
): Promise<void> {
  const res = await agentBackup("/backup/delete", { slug, id: backupId });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Échec de la suppression de l'archive.");
  }
}

/** Nombre de sauvegardes manuelles détenues par un propriétaire (tous serveurs). */
export async function ownerManualBackupCount(ownerId: string): Promise<number> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.backups)
    .where(
      and(
        eq(schema.backups.ownerId, ownerId),
        eq(schema.backups.kind, "manual"),
      ),
    );
  return row?.n ?? 0;
}

/** Nombre de sauvegardes manuelles d'un serveur donné. */
export async function serverManualBackupCount(serverId: string): Promise<number> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.backups)
    .where(
      and(
        eq(schema.backups.serverId, serverId),
        eq(schema.backups.kind, "manual"),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Somme des backupLimit alloués aux serveurs d'un propriétaire — sert à borner
 * la répartition de son quota total (hors serveur en cours d'édition).
 */
export async function ownerAllocatedBackups(
  ownerId: string,
  excludeServerId?: string,
): Promise<number> {
  const rows = await db()
    .select({ id: schema.servers.id, limit: schema.servers.backupLimit })
    .from(schema.servers)
    .where(eq(schema.servers.ownerId, ownerId));
  return rows
    .filter((r) => r.id !== excludeServerId)
    .reduce((sum, r) => sum + r.limit, 0);
}
