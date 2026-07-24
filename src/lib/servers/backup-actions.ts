"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";
import { requireServerPermission, serverAccess } from "./authz";
import {
  agentDeleteArchive,
  agentRestoreArchive,
  ownerAllocatedBackups,
  performServerBackup,
  serverManualBackupCount,
} from "./backups";
import { setReplicas, waitPodGone } from "./k8s";

export type BackupFormState = { error?: string; success?: string };

/**
 * Alloue un nombre de sauvegardes à un serveur (par son propriétaire). Borné
 * par le quota total du propriétaire : la somme des backupLimit de ses serveurs
 * ne peut pas dépasser son backupQuota.
 */
export async function updateServerBackupLimitAction(
  _prev: BackupFormState,
  formData: FormData,
): Promise<BackupFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  // Réservé au propriétaire/admin (qui répartit son propre quota).
  const access = await serverAccess(user, serverId);
  if (!access || !access.privileged) return { error: "Accès refusé." };
  const server = access.server;

  const [owner] = await db()
    .select({
      isAdmin: schema.users.isAdmin,
      canBackup: schema.users.canBackup,
      backupQuota: schema.users.backupQuota,
    })
    .from(schema.users)
    .where(eq(schema.users.id, server.ownerId))
    .limit(1);
  if (!owner || !(owner.isAdmin || owner.canBackup)) {
    return { error: "Les sauvegardes ne sont pas activées pour ce compte." };
  }

  const wanted = Number.parseInt(String(formData.get("backupLimit") ?? ""), 10);
  if (!Number.isFinite(wanted) || wanted < 0 || wanted > 1000) {
    return { error: "Nombre de sauvegardes invalide." };
  }

  // Admin : pas de quota total. Sinon : somme des autres serveurs + demande.
  const quota = owner.isAdmin ? Infinity : owner.backupQuota;
  const otherAllocated = await ownerAllocatedBackups(server.ownerId, server.id);
  if (otherAllocated + wanted > quota) {
    const remaining = Math.max(0, quota - otherAllocated);
    return {
      error: `Quota dépassé : ${remaining} sauvegarde(s) restante(s) à répartir (total ${owner.backupQuota}).`,
    };
  }

  // Baisser la limite sous le nombre de sauvegardes existantes est refusé :
  // il faudrait en supprimer d'abord (on ne détruit rien en silence).
  const existing = await serverManualBackupCount(server.id);
  if (wanted < existing) {
    return {
      error: `Ce serveur a déjà ${existing} sauvegarde(s). Supprime-en avant de descendre la limite.`,
    };
  }

  await db()
    .update(schema.servers)
    .set({ backupLimit: wanted, updatedAt: new Date() })
    .where(eq(schema.servers.id, server.id));

  revalidatePath(`/servers/${server.shortId}/settings/management`);
  revalidatePath(`/servers/${server.shortId}/backups`);
  return { success: `Allocation mise à jour : ${wanted} sauvegarde(s).` };
}

/**
 * Le compte a-t-il le droit de faire des sauvegardes ? (admin toujours oui).
 * Le droit vient du compte propriétaire du serveur, pas du membre qui agit :
 * un membre invité ne consomme pas SON quota mais celui du propriétaire.
 */
async function ownerCanBackup(ownerId: string): Promise<boolean> {
  const [owner] = await db()
    .select({ isAdmin: schema.users.isAdmin, canBackup: schema.users.canBackup })
    .from(schema.users)
    .where(eq(schema.users.id, ownerId))
    .limit(1);
  return !!owner && (owner.isAdmin || owner.canBackup);
}

function revalidate(shortId: string, id: string) {
  revalidatePath(`/servers/${shortId}/backups`);
  revalidatePath(`/servers/${id}/backups`);
}

/**
 * Crée une sauvegarde manuelle : arrête proprement le serveur, archive le
 * volume, puis le redémarre s'il tournait. Bornée par le backupLimit du serveur.
 */
export async function createBackupAction(
  _prev: BackupFormState,
  formData: FormData,
): Promise<BackupFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 255) || null;

  const server = await requireServerPermission(user, serverId, "backups.create");

  if (!(await ownerCanBackup(server.ownerId))) {
    return { error: "Les sauvegardes ne sont pas activées pour ce compte." };
  }

  const result = await performServerBackup(server, {
    createdBy: user.id,
    note,
    rotate: false,
  });
  if (result.error) return { error: result.error };

  revalidate(server.shortId, server.id);
  return { success: "Sauvegarde créée." };
}

/** Restaure une sauvegarde dans le serveur (écrase les fichiers actuels). */
export async function restoreBackupAction(
  serverId: string,
  backupId: string,
): Promise<BackupFormState> {
  const user = await currentUser();
  const server = await requireServerPermission(user, serverId, "backups.restore");

  const [backup] = await db()
    .select()
    .from(schema.backups)
    .where(and(eq(schema.backups.id, backupId), eq(schema.backups.serverId, server.id)))
    .limit(1);
  if (!backup) return { error: "Sauvegarde introuvable." };

  const wasRunning = server.desiredState === "running";
  try {
    if (wasRunning) {
      await setReplicas(server.slug, 0);
      await waitPodGone(server.slug);
    }
    await agentRestoreArchive(server.slug, backup.id);
  } catch (error) {
    if (wasRunning) await setReplicas(server.slug, 1).catch(() => {});
    return {
      error: error instanceof Error ? error.message : "Échec de la restauration.",
    };
  }
  if (wasRunning) await setReplicas(server.slug, 1).catch(() => {});

  revalidate(server.shortId, server.id);
  return { success: "Sauvegarde restaurée." };
}

/** Supprime une sauvegarde (ligne + archive). */
export async function deleteBackupAction(
  serverId: string,
  backupId: string,
): Promise<BackupFormState> {
  const user = await currentUser();
  const server = await requireServerPermission(user, serverId, "backups.delete");

  const [backup] = await db()
    .select()
    .from(schema.backups)
    .where(and(eq(schema.backups.id, backupId), eq(schema.backups.serverId, server.id)))
    .limit(1);
  if (!backup) return { error: "Sauvegarde introuvable." };

  await agentDeleteArchive(server.slug, backup.id).catch(() => {});
  await db().delete(schema.backups).where(eq(schema.backups.id, backup.id));

  revalidate(server.shortId, server.id);
  return { success: "Sauvegarde supprimée." };
}

/** Supprime n'importe quelle sauvegarde (admin) — y compris les pre_delete. */
export async function adminDeleteBackup(backupId: string): Promise<BackupFormState> {
  const user = await currentUser();
  if (!user.isAdmin) return { error: "Réservé aux admins." };

  const [backup] = await db()
    .select()
    .from(schema.backups)
    .where(eq(schema.backups.id, backupId))
    .limit(1);
  if (!backup) return { error: "Sauvegarde introuvable." };

  await agentDeleteArchive(backup.serverSlug, backup.id).catch(() => {});
  await db().delete(schema.backups).where(eq(schema.backups.id, backup.id));

  revalidatePath("/admin/backups");
  return { success: "Sauvegarde supprimée." };
}

/** Liste des sauvegardes manuelles d'un serveur (les plus récentes d'abord). */
export async function listServerBackups(serverId: string) {
  const user = await currentUser();
  const access = await serverAccess(user, serverId);
  if (!access || !access.permissions.has("backups.read")) return [];
  return db()
    .select()
    .from(schema.backups)
    .where(
      and(
        eq(schema.backups.serverId, access.server.id),
        eq(schema.backups.kind, "manual"),
      ),
    )
    .orderBy(desc(schema.backups.createdAt));
}
