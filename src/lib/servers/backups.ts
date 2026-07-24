import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { Server } from "@/lib/db/schema";
import { resolveVolumeDir } from "./files";
import { setReplicas, waitPodGone } from "./k8s";

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

/**
 * Cœur de la création d'une sauvegarde manuelle : arrêt propre du serveur,
 * archive, redémarrage. Respecte le plafond du serveur ; `rotate` supprime la
 * plus ancienne au lieu de refuser (utilisé par le planificateur pour qu'une
 * sauvegarde quotidienne ne se bloque pas). Renvoie l'erreur en texte ou null.
 */
export async function performServerBackup(
  server: Server,
  opts: { createdBy: string | null; note: string | null; rotate?: boolean },
): Promise<{ error: string | null; sizeBytes?: number }> {
  if (server.backupLimit <= 0) return { error: "Aucune sauvegarde allouée." };

  const existing = await serverManualBackupCount(server.id);
  if (existing >= server.backupLimit) {
    if (!opts.rotate) {
      return {
        error: `Limite atteinte (${existing}/${server.backupLimit}). Supprime une sauvegarde d'abord.`,
      };
    }
    // Rotation : retire la ou les plus anciennes pour faire de la place.
    const olds = await db()
      .select({ id: schema.backups.id, slug: schema.backups.serverSlug })
      .from(schema.backups)
      .where(
        and(eq(schema.backups.serverId, server.id), eq(schema.backups.kind, "manual")),
      )
      .orderBy(asc(schema.backups.createdAt))
      .limit(existing - server.backupLimit + 1);
    for (const old of olds) {
      await agentDeleteArchive(old.slug, old.id).catch(() => {});
      await db().delete(schema.backups).where(eq(schema.backups.id, old.id));
    }
  }

  const [row] = await db()
    .insert(schema.backups)
    .values({
      serverId: server.id,
      serverSlug: server.slug,
      serverName: server.name,
      ownerId: server.ownerId,
      kind: "manual",
      note: opts.note,
      createdBy: opts.createdBy,
      sizeBytes: 0,
    })
    .returning({ id: schema.backups.id });

  const wasRunning = server.desiredState === "running";
  try {
    if (wasRunning) {
      await setReplicas(server.slug, 0);
      await waitPodGone(server.slug);
    }
    const size = await agentCreateArchive(server.slug, row.id);
    await db()
      .update(schema.backups)
      .set({ sizeBytes: size })
      .where(eq(schema.backups.id, row.id));
    if (wasRunning) await setReplicas(server.slug, 1).catch(() => {});
    return { error: null, sizeBytes: size };
  } catch (error) {
    await db().delete(schema.backups).where(eq(schema.backups.id, row.id));
    await agentDeleteArchive(server.slug, row.id).catch(() => {});
    if (wasRunning) await setReplicas(server.slug, 1).catch(() => {});
    return {
      error: error instanceof Error ? error.message : "Échec de la sauvegarde.",
    };
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
