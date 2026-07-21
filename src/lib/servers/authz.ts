import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Server } from "@/lib/db/schema";
import type { SafeUser } from "@/lib/auth/user";

/** Charge un serveur en vérifiant que l'utilisateur en est owner ou admin. */
export async function loadServerFor(
  user: SafeUser,
  serverId: string,
): Promise<Server> {
  const rows = await db()
    .select()
    .from(schema.servers)
    .where(eq(schema.servers.id, serverId))
    .limit(1);
  const server = rows[0];
  if (!server) throw new Error("Serveur introuvable");
  if (server.ownerId !== user.id && !user.isAdmin) {
    throw new Error("Accès refusé");
  }
  return server;
}
