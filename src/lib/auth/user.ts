import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getSession } from "./session";
import { canAccess, landingPath } from "./dashboard-permissions";

export type SafeUser = {
  id: string;
  username: string;
  email: string | null;
  origin: "k8s" | "minecraft" | "bot";
  hasAvatar: boolean;
  discordId: string | null;
  isAdmin: boolean;
  canCreateServers: boolean;
  /** Sections du dashboard autorisées (voir dashboard-permissions.ts). */
  permissions: string[];
  quotaMaxServers: number;
  quotaMemoryMi: number;
  quotaCpuMilli: number;
  quotaDiskGi: number;
  /** Ports externes autorisés (spec brute) ; null = plage globale par défaut. */
  portAllowlist: string | null;
  /** Epoch ms de la dernière modification — sert de cache-buster avatar. */
  updatedAt: number;
};

/** Charge un utilisateur par son id sous forme SafeUser, ou null. */
export async function loadSafeUser(userId: string): Promise<SafeUser | null> {
  const rows = await db()
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      origin: schema.users.origin,
      avatar: schema.users.avatar,
      discordId: schema.users.discordId,
      isAdmin: schema.users.isAdmin,
      canCreateServers: schema.users.canCreateServers,
      permissions: schema.users.permissions,
      quotaMaxServers: schema.users.quotaMaxServers,
      quotaMemoryMi: schema.users.quotaMemoryMi,
      quotaCpuMilli: schema.users.quotaCpuMilli,
      quotaDiskGi: schema.users.quotaDiskGi,
      portAllowlist: schema.users.portAllowlist,
      updatedAt: schema.users.updatedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    origin: user.origin,
    hasAvatar: user.avatar !== null,
    discordId: user.discordId,
    isAdmin: user.isAdmin,
    canCreateServers: user.canCreateServers,
    permissions: user.permissions ?? [],
    quotaMaxServers: user.quotaMaxServers,
    quotaMemoryMi: user.quotaMemoryMi,
    quotaCpuMilli: user.quotaCpuMilli,
    quotaDiskGi: user.quotaDiskGi,
    portAllowlist: user.portAllowlist,
    updatedAt: user.updatedAt.valueOf(),
  };
}

/** Utilisateur connecté ou null (usage API routes). */
export async function sessionUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session.loggedIn || !session.userId) return null;
  return loadSafeUser(session.userId);
}

/** Utilisateur connecté (pages). Redirige vers /login si session invalide. */
export async function currentUser(): Promise<SafeUser> {
  const user = await sessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Exige l'accès à une section du dashboard. Redirige vers la page
 * d'atterrissage autorisée si l'utilisateur n'a pas la permission.
 * Les admins passent toujours.
 */
export async function requireView(perm: string): Promise<SafeUser> {
  const user = await currentUser();
  if (!canAccess(user, perm)) {
    redirect(landingPath(user));
  }
  return user;
}
