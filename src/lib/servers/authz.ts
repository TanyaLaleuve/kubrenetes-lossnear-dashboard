import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Server } from "@/lib/db/schema";
import type { SafeUser } from "@/lib/auth/user";
import { ALL_PERMISSIONS, type Permission } from "./permissions";

export type ServerAccess = {
  server: Server;
  permissions: Set<Permission>;
  /** Propriétaire du serveur ou admin global : contrôle total. */
  privileged: boolean;
};

/**
 * Accès d'un utilisateur à un serveur : renvoie ses permissions effectives,
 * ou null s'il n'a aucun accès (ni propriétaire, ni admin, ni membre).
 */
export async function serverAccess(
  user: SafeUser,
  serverId: string,
): Promise<ServerAccess | null> {
  const rows = await db()
    .select()
    .from(schema.servers)
    .where(eq(schema.servers.id, serverId))
    .limit(1);
  const server = rows[0];
  if (!server) return null;

  if (user.isAdmin || server.ownerId === user.id) {
    return { server, permissions: new Set(ALL_PERMISSIONS), privileged: true };
  }

  const members = await db()
    .select({ permissions: schema.serverMembers.permissions })
    .from(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverId),
        eq(schema.serverMembers.userId, user.id),
      ),
    )
    .limit(1);
  const member = members[0];
  if (!member) return null;

  return {
    server,
    permissions: new Set(member.permissions),
    privileged: false,
  };
}

/** Charge le serveur en exigeant une permission précise. Lève sinon. */
export async function requireServerPermission(
  user: SafeUser,
  serverId: string,
  permission: Permission,
): Promise<Server> {
  const access = await serverAccess(user, serverId);
  if (!access || !access.permissions.has(permission)) {
    throw new Error("Accès refusé");
  }
  return access.server;
}

/** Charge le serveur en exigeant le rôle propriétaire/admin (actions sensibles). */
export async function requirePrivileged(
  user: SafeUser,
  serverId: string,
): Promise<Server> {
  const access = await serverAccess(user, serverId);
  if (!access || !access.privileged) {
    throw new Error("Réservé au propriétaire ou à un admin");
  }
  return access.server;
}

/**
 * Ancienne garde propriétaire/admin, conservée pour les appels existants.
 * @deprecated privilégier requireServerPermission / requirePrivileged.
 */
export async function loadServerFor(
  user: SafeUser,
  serverId: string,
): Promise<Server> {
  return requirePrivileged(user, serverId);
}
