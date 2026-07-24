import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Journal d'activité serveur : trace qui a fait quoi (lecture seule côté UI).
 * Volontairement tolérant aux pannes : une écriture ratée ne doit jamais faire
 * échouer l'action métier qu'elle accompagne.
 */
export type Actor =
  | { id: string; username: string }
  | { system: string }; // action système (cron, réconciliateur, IA sans compte)

export async function logActivity(input: {
  serverId: string;
  actor: Actor;
  action: string;
  detail?: string;
}): Promise<void> {
  try {
    const actor = input.actor;
    const userId = "id" in actor ? actor.id : null;
    const actorName = "id" in actor ? actor.username : actor.system;
    await db().insert(schema.activityLogs).values({
      serverId: input.serverId,
      userId,
      actorName: actorName.slice(0, 64),
      action: input.action.slice(0, 48),
      detail: (input.detail ?? "").slice(0, 512),
    });
  } catch {
    // Journalisation best-effort : on n'interrompt pas l'action métier.
  }
}

export type ActivityEntry = {
  id: string;
  actorName: string;
  userId: string | null;
  action: string;
  detail: string;
  createdAt: Date;
};

/** Dernières entrées du journal d'un serveur (plus récentes d'abord). */
export async function listActivity(
  serverId: string,
  limit = 200,
): Promise<ActivityEntry[]> {
  return db()
    .select({
      id: schema.activityLogs.id,
      actorName: schema.activityLogs.actorName,
      userId: schema.activityLogs.userId,
      action: schema.activityLogs.action,
      detail: schema.activityLogs.detail,
      createdAt: schema.activityLogs.createdAt,
    })
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.serverId, serverId))
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(Math.min(limit, 500));
}
